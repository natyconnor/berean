import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findVerseMemory, getOrCreateVerseMemory } from "./lib/verseMemory";
import {
  isDueForReview,
  isReviewPhase,
  scheduleNext,
} from "../src/lib/memory-scheduler";
import {
  bucketAccuracyAverages,
  bucketForecastCounts,
  bucketReviewCounts,
  normalizeTimeZone,
  startOfZonedDay,
  zonedDayStarts,
  zonedUpcomingDayStarts,
} from "../src/lib/dashboard-buckets";

/** Clamp a caller-supplied day count to a sane bounded window. */
const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 366;

function normalizeDays(days: number | undefined): number {
  if (days === undefined || !Number.isFinite(days)) return DEFAULT_WINDOW_DAYS;
  const rounded = Math.floor(days);
  if (rounded < 1) return 1;
  if (rounded > MAX_WINDOW_DAYS) return MAX_WINDOW_DAYS;
  return rounded;
}

const DEFAULT_DUE_LIMIT = 50;

const statusValidator = v.union(
  v.literal("new"),
  v.literal("learning"),
  v.literal("reviewing"),
  v.literal("mastered"),
);

const qualityValidator = v.union(
  v.literal("exact"),
  v.literal("close"),
  v.literal("off"),
);

const modeValidator = v.union(
  v.literal("learn"),
  v.literal("review"),
  v.literal("deck"),
  v.literal("practice"),
);

/** The schedule returned by the pure scheduler. */
const memoryScheduleValidator = v.object({
  status: statusValidator,
  learnStage: v.number(),
  stageReps: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  earlyReviewApplied: v.boolean(),
});

/** A full `verseMemory` row (system `_creationTime` omitted). */
const verseMemoryValidator = v.object({
  _id: v.id("verseMemory"),
  userId: v.id("users"),
  verseRefId: v.id("verseRefs"),
  status: statusValidator,
  learnStage: v.number(),
  stageReps: v.optional(v.number()),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  earlyReviewApplied: v.optional(v.boolean()),
  lastReviewedAt: v.optional(v.number()),
  createdAt: v.number(),
});

/** A due row joined to its resolved verse reference. */
const dueQueueItem = v.object({
  _id: v.id("verseMemory"),
  verseRefId: v.id("verseRefs"),
  status: statusValidator,
  learnStage: v.number(),
  stageReps: v.optional(v.number()),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  earlyReviewApplied: v.optional(v.boolean()),
  lastReviewedAt: v.optional(v.number()),
  createdAt: v.number(),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

function toRowView(row: Doc<"verseMemory">) {
  return {
    _id: row._id,
    userId: row.userId,
    verseRefId: row.verseRefId,
    status: row.status,
    learnStage: row.learnStage,
    stageReps: row.stageReps,
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    earlyReviewApplied: row.earlyReviewApplied,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Verses due for review at `now` (soonest first), joined to their verse ref.
 *
 * Only `reviewing` / `mastered` verses with `dueAt <= now` qualify — learning-
 * phase verses are practiced from the verse detail / learn flow, not the review
 * queue. Heart-aware: only currently hearted verses (have a `savedVerses` row)
 * are returned. A verse un-hearted after review keeps its `verseMemory` row as
 * durable history, but drops out of the live due queue until re-hearted.
 * `now` is passed in by the caller so the query stays deterministic/cacheable.
 */
export const dueQueue = query({
  args: { now: v.number(), limit: v.optional(v.number()) },
  returns: v.array(dueQueueItem),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit ?? DEFAULT_DUE_LIMIT;

    const dueRows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_dueAt", (q) =>
        q.eq("userId", userId).lte("dueAt", args.now),
      )
      .order("asc")
      .collect();

    const items: Array<{
      _id: Id<"verseMemory">;
      verseRefId: Id<"verseRefs">;
      status: Doc<"verseMemory">["status"];
      learnStage: number;
      stageReps?: number;
      ease: number;
      intervalDays: number;
      dueAt: number;
      consecutiveCorrect: number;
      lapses: number;
      earlyReviewApplied?: boolean;
      lastReviewedAt?: number;
      createdAt: number;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }> = [];

    for (const row of dueRows) {
      if (items.length >= limit) break;
      if (!isDueForReview(row, args.now)) continue;

      const saved = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_verseRefId", (q) =>
          q.eq("userId", userId).eq("verseRefId", row.verseRefId),
        )
        .unique();
      if (!saved) continue;

      const ref = await ctx.db.get(row.verseRefId);
      if (!ref || ref.userId !== userId) continue;

      items.push({
        _id: row._id,
        verseRefId: row.verseRefId,
        status: row.status,
        learnStage: row.learnStage,
        stageReps: row.stageReps,
        ease: row.ease,
        intervalDays: row.intervalDays,
        dueAt: row.dueAt,
        consecutiveCorrect: row.consecutiveCorrect,
        lapses: row.lapses,
        earlyReviewApplied: row.earlyReviewApplied,
        lastReviewedAt: row.lastReviewedAt,
        createdAt: row.createdAt,
        book: ref.book,
        chapter: ref.chapter,
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
      });
    }

    return items;
  },
});

/**
 * Cheap count of verses due for review at `now` (`reviewing` / `mastered`
 * only). Heart-aware: only currently-hearted verses (with a `savedVerses` row)
 * are counted. Drives the dock badge.
 */
export const dueCount = query({
  args: { now: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return 0;
    }

    const dueRows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_dueAt", (q) =>
        q.eq("userId", userId).lte("dueAt", args.now),
      )
      .collect();

    let count = 0;
    for (const row of dueRows) {
      if (!isDueForReview(row, args.now)) continue;
      const saved = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_verseRefId", (q) =>
          q.eq("userId", userId).eq("verseRefId", row.verseRefId),
        )
        .unique();
      if (saved) count += 1;
    }
    return count;
  },
});

/**
 * Log a graded attempt and reschedule the verse in one atomic mutation.
 *
 * Appends a `verseMemoryReviews` row, loads (or seeds) the `verseMemory` row,
 * applies the pure `scheduleNext`, and patches the row. Returns the new
 * schedule so callers can reflect the updated `dueAt`/status immediately.
 */
export const recordAttempt = mutation({
  args: {
    verseRefId: v.id("verseRefs"),
    quality: qualityValidator,
    accuracy: v.number(),
    stage: v.number(),
    mode: modeValidator,
    durationMs: v.optional(v.number()),
    now: v.number(),
    wordCount: v.optional(v.number()),
  },
  returns: memoryScheduleValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) {
      throw new Error("Verse reference not found");
    }

    const memory = await getOrCreateVerseMemory(
      ctx,
      userId,
      args.verseRefId,
      args.now,
    );

    await ctx.db.insert("verseMemoryReviews", {
      userId,
      verseRefId: args.verseRefId,
      verseMemoryId: memory._id,
      quality: args.quality,
      accuracy: args.accuracy,
      stage: args.stage,
      mode: args.mode,
      durationMs: args.durationMs,
      createdAt: args.now,
    });

    const next = scheduleNext(
      {
        status: memory.status,
        learnStage: memory.learnStage,
        stageReps: memory.stageReps ?? 0,
        ease: memory.ease,
        intervalDays: memory.intervalDays,
        dueAt: memory.dueAt,
        consecutiveCorrect: memory.consecutiveCorrect,
        lapses: memory.lapses,
        earlyReviewApplied: memory.earlyReviewApplied ?? false,
      },
      {
        quality: args.quality,
        accuracy: args.accuracy,
        mode: args.mode,
        now: args.now,
        wordCount: args.wordCount,
      },
    );

    await ctx.db.patch(memory._id, {
      status: next.status,
      learnStage: next.learnStage,
      stageReps: next.stageReps,
      ease: next.ease,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt,
      consecutiveCorrect: next.consecutiveCorrect,
      lapses: next.lapses,
      earlyReviewApplied: next.earlyReviewApplied,
      lastReviewedAt: args.now,
    });

    return next;
  },
});

/** Idempotent upsert of the verse-memory row for a verse the user owns. */
export const getOrCreateForVerse = mutation({
  args: { verseRefId: v.id("verseRefs"), now: v.number() },
  returns: verseMemoryValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) {
      throw new Error("Verse reference not found");
    }

    const memory = await getOrCreateVerseMemory(
      ctx,
      userId,
      args.verseRefId,
      args.now,
    );
    return toRowView(memory);
  },
});

const memoryStatsValidator = v.object({
  new: v.number(),
  learning: v.number(),
  reviewing: v.number(),
  mastered: v.number(),
  total: v.number(),
  due: v.number(),
});

/**
 * Per-status counts for the current user, plus a due-now tally of review-phase
 * verses (`reviewing` / `mastered` with `dueAt <= now`).
 *
 * Heart-aware: the canonical in-Memory set is the user's hearted verses
 * (`savedVerses`), so we iterate those and join each to its `verseMemory` row.
 * A verse un-hearted after review keeps its memory row but is not counted here.
 */
export const memoryStats = query({
  args: { now: v.number() },
  returns: memoryStatsValidator,
  handler: async (ctx, args) => {
    const empty = {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
      total: 0,
      due: 0,
    };

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return empty;
    }

    const saved = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const stats = { ...empty };
    for (const row of saved) {
      const memory = await findVerseMemory(ctx, userId, row.verseRefId);
      if (!memory) continue;
      stats[memory.status] += 1;
      stats.total += 1;
      if (isDueForReview(memory, args.now)) {
        stats.due += 1;
      }
    }
    return stats;
  },
});

const dayCountValidator = v.object({
  dayStart: v.number(),
  count: v.number(),
});

/**
 * Per-day review counts over the last `days` (default 30, local day buckets).
 *
 * Bounded by the time window via the `by_userId_createdAt` index range on
 * `createdAt`, so it never scans the whole log. `now` and `timeZone` are
 * passed in to keep the query deterministic; see `dashboard-buckets.ts`.
 */
export const reviewHeatmap = query({
  args: {
    now: v.number(),
    timeZone: v.string(),
    days: v.optional(v.number()),
  },
  returns: v.array(dayCountValidator),
  handler: async (ctx, args) => {
    const days = normalizeDays(args.days);
    const timeZone = normalizeTimeZone(args.timeZone);
    const dayStarts = zonedDayStarts(args.now, days, timeZone);
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return dayStarts.map((dayStart) => ({ dayStart, count: 0 }));
    }

    const windowStart = dayStarts[0];
    const rows = await ctx.db
      .query("verseMemoryReviews")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", windowStart),
      )
      .collect();

    const counts = bucketReviewCounts(
      rows.map((row) => row.createdAt),
      args.now,
      days,
      timeZone,
    );
    return dayStarts.map((dayStart, i) => ({ dayStart, count: counts[i] }));
  },
});

const dayAccuracyValidator = v.object({
  dayStart: v.number(),
  average: v.union(v.number(), v.null()),
  count: v.number(),
});

/**
 * Per-day average accuracy over the last `days` (default 30, local day buckets).
 *
 * Days with no reviews report `average: null` (not 0). Bounded by the window
 * via the `by_userId_createdAt` index range on `createdAt`.
 */
export const accuracyTrend = query({
  args: {
    now: v.number(),
    timeZone: v.string(),
    days: v.optional(v.number()),
  },
  returns: v.array(dayAccuracyValidator),
  handler: async (ctx, args) => {
    const days = normalizeDays(args.days);
    const timeZone = normalizeTimeZone(args.timeZone);
    const dayStarts = zonedDayStarts(args.now, days, timeZone);
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return dayStarts.map((dayStart) => ({
        dayStart,
        average: null,
        count: 0,
      }));
    }

    const windowStart = dayStarts[0];
    const rows = await ctx.db
      .query("verseMemoryReviews")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", windowStart),
      )
      .collect();

    const buckets = bucketAccuracyAverages(
      rows.map((row) => ({ createdAt: row.createdAt, accuracy: row.accuracy })),
      args.now,
      days,
      timeZone,
    );
    return dayStarts.map((dayStart, i) => ({
      dayStart,
      average: buckets[i].average,
      count: buckets[i].count,
    }));
  },
});

/**
 * Count of review-phase verses due per upcoming day over the next `days`
 * (default 30). Learning-phase verses are excluded.
 *
 * Overdue verses are folded into today (day 0). Heart-aware: un-hearted verses
 * (no `savedVerses` row) are skipped even though their memory row survives.
 * Reads through `by_userId_dueAt`, bounded above by the end of the window; the
 * result set is at most the user's verse-memory corpus (same bound as
 * `memoryStats`). Day buckets use the viewer's IANA `timeZone`.
 */
export const reviewForecast = query({
  args: {
    now: v.number(),
    timeZone: v.string(),
    days: v.optional(v.number()),
  },
  returns: v.array(dayCountValidator),
  handler: async (ctx, args) => {
    const days = normalizeDays(args.days);
    const timeZone = normalizeTimeZone(args.timeZone);
    const dayStarts = zonedUpcomingDayStarts(args.now, days, timeZone);

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return dayStarts.map((dayStart) => ({ dayStart, count: 0 }));
    }

    // Exclusive end: local midnight of the day after the last forecast bucket.
    const lastDayStart = dayStarts[days - 1] ?? dayStarts[0];
    const windowEnd = startOfZonedDay(
      lastDayStart + 36 * 60 * 60 * 1000,
      timeZone,
    );
    const rows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_dueAt", (q) =>
        q.eq("userId", userId).lt("dueAt", windowEnd),
      )
      .collect();

    const dueAts: number[] = [];
    for (const row of rows) {
      // Learning-phase verses keep dueAt = now for practice availability, but
      // they are not part of the review forecast.
      if (!isReviewPhase(row.status)) continue;
      const saved = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_verseRefId", (q) =>
          q.eq("userId", userId).eq("verseRefId", row.verseRefId),
        )
        .unique();
      if (!saved) continue;
      dueAts.push(row.dueAt);
    }

    const counts = bucketForecastCounts(dueAts, args.now, days, timeZone);
    return dayStarts.map((dayStart, i) => ({ dayStart, count: counts[i] }));
  },
});

const masteryDistributionValidator = v.object({
  new: v.number(),
  learning: v.number(),
  reviewing: v.number(),
  mastered: v.number(),
  total: v.number(),
});

/**
 * Counts of verses by lifecycle status for the current user.
 *
 * Heart-aware: iterates the user's hearted verses (`savedVerses`) and joins
 * each to its `verseMemory` row, so un-hearted verses (whose memory row
 * survives as history) don't inflate the distribution.
 */
export const masteryDistribution = query({
  args: { now: v.number() },
  returns: masteryDistributionValidator,
  handler: async (ctx) => {
    const empty = {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
      total: 0,
    };

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return empty;
    }

    const saved = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const stats = { ...empty };
    for (const row of saved) {
      const memory = await findVerseMemory(ctx, userId, row.verseRefId);
      if (!memory) continue;
      stats[memory.status] += 1;
      stats.total += 1;
    }
    return stats;
  },
});

// ---------- Library + drill-down (PR 7) ----------

const librarySortValidator = v.union(
  v.literal("dueAt"),
  v.literal("status"),
  v.literal("recent"),
);

/** One hearted verse: its live memory schedule joined to its reference. */
const libraryItemValidator = v.object({
  verseMemoryId: v.id("verseMemory"),
  verseRefId: v.id("verseRefs"),
  savedVerseId: v.id("savedVerses"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  status: statusValidator,
  learnStage: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  lapses: v.number(),
  lastReviewedAt: v.optional(v.number()),
  heartedAt: v.number(),
});

type LibraryItem = {
  verseMemoryId: Id<"verseMemory">;
  verseRefId: Id<"verseRefs">;
  savedVerseId: Id<"savedVerses">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  status: Doc<"verseMemory">["status"];
  learnStage: number;
  ease: number;
  intervalDays: number;
  dueAt: number;
  lapses: number;
  lastReviewedAt?: number;
  heartedAt: number;
};

function toLibraryItem(
  memory: Doc<"verseMemory">,
  ref: Doc<"verseRefs">,
  saved: Doc<"savedVerses">,
): LibraryItem {
  return {
    verseMemoryId: memory._id,
    verseRefId: memory.verseRefId,
    savedVerseId: saved._id,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
    status: memory.status,
    learnStage: memory.learnStage,
    ease: memory.ease,
    intervalDays: memory.intervalDays,
    dueAt: memory.dueAt,
    lapses: memory.lapses,
    lastReviewedAt: memory.lastReviewedAt,
    heartedAt: saved.createdAt,
  };
}

/**
 * A page of the user's hearted verses, each joined to its live memory schedule
 * and verse reference. Paginated via `paginationOptsValidator`/`.paginate()`.
 *
 * `sort` picks the index the page is read through so ordering is stable across
 * pages (never a cross-page in-memory sort):
 * - `"dueAt"` — verses by next-due soonest first (`by_userId_dueAt`).
 * - `"status"` — verses grouped by lifecycle status (`by_userId_status`, index
 *   order — alphabetical, not lifecycle order; documented in study-mode.md).
 * - `"recent"` — most recently hearted first (`savedVerses.by_userId_createdAt`).
 *
 * The canonical set is the user's *hearted* verses (`savedVerses`). For the
 * memory-indexed sorts, rows without a matching heart are filtered out (a verse
 * un-hearted after review keeps its memory row, so we must exclude it here). A
 * hearted verse still awaiting its `verseMemory` seed (legacy, pre-backfill) is
 * skipped rather than fabricated. Filtering shrinks a page but keeps cursors
 * correct, per the Convex pagination guidance.
 */
export const listLibrary = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sort: librarySortValidator,
  },
  returns: v.object({
    page: v.array(libraryItemValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    if (args.sort === "recent") {
      const paginated = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
        .order("desc")
        .paginate(args.paginationOpts);

      const page: LibraryItem[] = [];
      for (const saved of paginated.page) {
        const ref = await ctx.db.get(saved.verseRefId);
        if (!ref || ref.userId !== userId) continue;
        const memory = await findVerseMemory(ctx, userId, saved.verseRefId);
        if (!memory) continue;
        page.push(toLibraryItem(memory, ref, saved));
      }
      return { ...paginated, page };
    }

    const memoryQuery =
      args.sort === "dueAt"
        ? ctx.db
            .query("verseMemory")
            .withIndex("by_userId_dueAt", (q) => q.eq("userId", userId))
            .order("asc")
        : ctx.db
            .query("verseMemory")
            .withIndex("by_userId_status", (q) => q.eq("userId", userId))
            .order("asc");

    const paginated = await memoryQuery.paginate(args.paginationOpts);

    const page: LibraryItem[] = [];
    for (const memory of paginated.page) {
      const saved = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_verseRefId", (q) =>
          q.eq("userId", userId).eq("verseRefId", memory.verseRefId),
        )
        .unique();
      if (!saved) continue;
      const ref = await ctx.db.get(memory.verseRefId);
      if (!ref || ref.userId !== userId) continue;
      page.push(toLibraryItem(memory, ref, saved));
    }
    return { ...paginated, page };
  },
});

/** How many recent attempts the drill-down shows. */
const VERSE_DETAIL_ATTEMPT_LIMIT = 20;
/**
 * Upper bound on log rows scanned while gathering one verse's recent attempts.
 * `verseMemoryReviews` is only indexed `by_userId_createdAt` (no per-verse
 * index), so we walk the user's log newest-first and stop once we have enough
 * matches or hit this cap — keeping the read bounded on very active users.
 */
const VERSE_DETAIL_SCAN_LIMIT = 500;

const attemptValidator = v.object({
  quality: qualityValidator,
  accuracy: v.number(),
  stage: v.number(),
  mode: modeValidator,
  durationMs: v.optional(v.number()),
  createdAt: v.number(),
});

/**
 * A difficulty signal derived purely from what IS stored. The per-token diffs
 * are not persisted (only `quality` + `accuracy` per attempt), so a literal
 * "hardest phrase" is not derivable; instead we surface the lowest-accuracy
 * signals and the learn stage that has been missed hardest.
 */
const difficultyValidator = v.object({
  attemptCount: v.number(),
  averageAccuracy: v.number(),
  worstAccuracy: v.number(),
  hardestStage: v.union(v.number(), v.null()),
});

const verseDetailValidator = v.object({
  verseRefId: v.id("verseRefs"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  isHearted: v.boolean(),
  heartedAt: v.union(v.number(), v.null()),
  isDue: v.boolean(),
  status: statusValidator,
  learnStage: v.number(),
  stageReps: v.optional(v.number()),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  lapses: v.number(),
  consecutiveCorrect: v.number(),
  lastReviewedAt: v.optional(v.number()),
  attempts: v.array(attemptValidator),
  difficulty: v.union(difficultyValidator, v.null()),
});

type Attempt = {
  quality: Doc<"verseMemoryReviews">["quality"];
  accuracy: number;
  stage: number;
  mode: Doc<"verseMemoryReviews">["mode"];
  durationMs?: number;
  createdAt: number;
};

/**
 * Derive a difficulty signal from the collected attempts. Returns `null` when
 * there are no attempts. `hardestStage` is the learn stage with the lowest mean
 * accuracy (ties broken toward the higher — harder — stage).
 */
function deriveDifficulty(attempts: Attempt[]): {
  attemptCount: number;
  averageAccuracy: number;
  worstAccuracy: number;
  hardestStage: number | null;
} | null {
  if (attempts.length === 0) return null;

  let sum = 0;
  let worst = attempts[0].accuracy;
  const byStage = new Map<number, { sum: number; count: number }>();
  for (const a of attempts) {
    sum += a.accuracy;
    if (a.accuracy < worst) worst = a.accuracy;
    const bucket = byStage.get(a.stage) ?? { sum: 0, count: 0 };
    bucket.sum += a.accuracy;
    bucket.count += 1;
    byStage.set(a.stage, bucket);
  }

  let hardestStage: number | null = null;
  let hardestAvg = Number.POSITIVE_INFINITY;
  for (const [stage, { sum: s, count }] of byStage) {
    const avg = s / count;
    if (
      avg < hardestAvg ||
      (avg === hardestAvg && stage > (hardestStage ?? -1))
    ) {
      hardestAvg = avg;
      hardestStage = stage;
    }
  }

  return {
    attemptCount: attempts.length,
    averageAccuracy: sum / attempts.length,
    worstAccuracy: worst,
    hardestStage,
  };
}

/**
 * Per-verse drill-down: the live schedule, the last N graded attempts, and a
 * derived difficulty signal. Returns `null` when the current user has no memory
 * row for the verse (never seeded / not theirs). `now` is passed in (never
 * `Date.now()` in a query) and only used to flag whether the verse is due now.
 */
export const verseDetail = query({
  args: { verseRefId: v.id("verseRefs"), now: v.number() },
  returns: v.union(verseDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) return null;

    const memory = await findVerseMemory(ctx, userId, args.verseRefId);
    if (!memory) return null;

    const saved = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_verseRefId", (q) =>
        q.eq("userId", userId).eq("verseRefId", args.verseRefId),
      )
      .unique();

    const attempts: Attempt[] = [];
    let scanned = 0;
    for await (const row of ctx.db
      .query("verseMemoryReviews")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")) {
      scanned += 1;
      if (row.verseRefId === args.verseRefId) {
        attempts.push({
          quality: row.quality,
          accuracy: row.accuracy,
          stage: row.stage,
          mode: row.mode,
          durationMs: row.durationMs,
          createdAt: row.createdAt,
        });
        if (attempts.length >= VERSE_DETAIL_ATTEMPT_LIMIT) break;
      }
      if (scanned >= VERSE_DETAIL_SCAN_LIMIT) break;
    }

    return {
      verseRefId: args.verseRefId,
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
      isHearted: saved !== null,
      heartedAt: saved?.createdAt ?? null,
      isDue: isDueForReview(memory, args.now),
      status: memory.status,
      learnStage: memory.learnStage,
      stageReps: memory.stageReps,
      ease: memory.ease,
      intervalDays: memory.intervalDays,
      dueAt: memory.dueAt,
      lapses: memory.lapses,
      consecutiveCorrect: memory.consecutiveCorrect,
      lastReviewedAt: memory.lastReviewedAt,
      attempts,
      difficulty: deriveDifficulty(attempts),
    };
  },
});
