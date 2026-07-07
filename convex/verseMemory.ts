import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  deriveActiveStatus,
  findVerseMemory,
  getOrCreateVerseMemory,
} from "./lib/verseMemory";
import { scheduleNext } from "../src/lib/memory-scheduler";
import {
  bucketAccuracyAverages,
  bucketForecastCounts,
  bucketReviewCounts,
  DAY_MS,
  startOfUtcDay,
  utcDayStarts,
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
  v.literal("suspended"),
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
);

/** The 7-field schedule returned by the pure scheduler. */
const memoryScheduleValidator = v.object({
  status: statusValidator,
  learnStage: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
});

/** A full `verseMemory` row (system `_creationTime` omitted). */
const verseMemoryValidator = v.object({
  _id: v.id("verseMemory"),
  userId: v.id("users"),
  verseRefId: v.id("verseRefs"),
  status: statusValidator,
  learnStage: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  lastReviewedAt: v.optional(v.number()),
  createdAt: v.number(),
});

/** A due row joined to its resolved verse reference. */
const dueQueueItem = v.object({
  _id: v.id("verseMemory"),
  verseRefId: v.id("verseRefs"),
  status: statusValidator,
  learnStage: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
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
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Verses due for study at `now` (soonest first), joined to their verse ref.
 *
 * Suspended verses are excluded. `now` is passed in by the caller so the query
 * stays deterministic/cacheable.
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
      ease: number;
      intervalDays: number;
      dueAt: number;
      consecutiveCorrect: number;
      lapses: number;
      lastReviewedAt?: number;
      createdAt: number;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }> = [];

    for (const row of dueRows) {
      if (items.length >= limit) break;
      if (row.status === "suspended") continue;

      const ref = await ctx.db.get(row.verseRefId);
      if (!ref || ref.userId !== userId) continue;

      items.push({
        _id: row._id,
        verseRefId: row.verseRefId,
        status: row.status,
        learnStage: row.learnStage,
        ease: row.ease,
        intervalDays: row.intervalDays,
        dueAt: row.dueAt,
        consecutiveCorrect: row.consecutiveCorrect,
        lapses: row.lapses,
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

/** Cheap count of verses due at `now` (excludes suspended). Drives the dock badge. */
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
      if (row.status !== "suspended") count += 1;
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
        ease: memory.ease,
        intervalDays: memory.intervalDays,
        dueAt: memory.dueAt,
        consecutiveCorrect: memory.consecutiveCorrect,
        lapses: memory.lapses,
      },
      {
        quality: args.quality,
        accuracy: args.accuracy,
        mode: args.mode,
        now: args.now,
      },
    );

    await ctx.db.patch(memory._id, {
      status: next.status,
      learnStage: next.learnStage,
      ease: next.ease,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt,
      consecutiveCorrect: next.consecutiveCorrect,
      lapses: next.lapses,
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

/**
 * Suspend or un-suspend a verse. Suspending removes it from the due queue and
 * records the active status in `previousStatus`; un-suspending restores that
 * status exactly (falling back to a schedule-derived status for legacy rows
 * that predate `previousStatus`).
 *
 * Returns the resulting status, or `null` when the user has no memory row for
 * the verse yet.
 */
export const setSuspended = mutation({
  args: { verseRefId: v.id("verseRefs"), suspended: v.boolean() },
  returns: v.union(statusValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const memory = await findVerseMemory(ctx, userId, args.verseRefId);
    if (!memory) {
      return null;
    }

    if (args.suspended) {
      if (memory.status === "suspended") {
        return "suspended" as const;
      }
      await ctx.db.patch(memory._id, {
        status: "suspended",
        previousStatus: memory.status,
      });
      return "suspended" as const;
    }

    if (memory.status !== "suspended") {
      return memory.status;
    }

    const restored = memory.previousStatus ?? deriveActiveStatus(memory);
    await ctx.db.patch(memory._id, {
      status: restored,
      previousStatus: undefined,
    });
    return restored;
  },
});

const memoryStatsValidator = v.object({
  new: v.number(),
  learning: v.number(),
  reviewing: v.number(),
  mastered: v.number(),
  suspended: v.number(),
  total: v.number(),
  due: v.number(),
});

/** Per-status counts for the current user, plus a due-now tally. */
export const memoryStats = query({
  args: { now: v.number() },
  returns: memoryStatsValidator,
  handler: async (ctx, args) => {
    const empty = {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
      suspended: 0,
      total: 0,
      due: 0,
    };

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return empty;
    }

    const rows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId))
      .collect();

    const stats = { ...empty };
    for (const row of rows) {
      stats[row.status] += 1;
      stats.total += 1;
      if (row.status !== "suspended" && row.dueAt <= args.now) {
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
 * Per-day review counts over the last `days` (default 30, UTC day buckets).
 *
 * Bounded by the time window via the `by_userId_createdAt` index range on
 * `createdAt`, so it never scans the whole log. `now` is passed in to keep the
 * query deterministic; see `dashboard-buckets.ts` for the UTC-day simplification.
 */
export const reviewHeatmap = query({
  args: { now: v.number(), days: v.optional(v.number()) },
  returns: v.array(dayCountValidator),
  handler: async (ctx, args) => {
    const days = normalizeDays(args.days);
    const dayStarts = utcDayStarts(args.now, days);
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
 * Per-day average accuracy over the last `days` (default 30, UTC day buckets).
 *
 * Days with no reviews report `average: null` (not 0). Bounded by the window
 * via the `by_userId_createdAt` index range on `createdAt`.
 */
export const accuracyTrend = query({
  args: { now: v.number(), days: v.optional(v.number()) },
  returns: v.array(dayAccuracyValidator),
  handler: async (ctx, args) => {
    const days = normalizeDays(args.days);
    const dayStarts = utcDayStarts(args.now, days);
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
    );
    return dayStarts.map((dayStart, i) => ({
      dayStart,
      average: buckets[i].average,
      count: buckets[i].count,
    }));
  },
});

/**
 * Count of verses due per upcoming day over the next `days` (default 30).
 *
 * Overdue verses are folded into today (day 0). Suspended verses are excluded.
 * Reads through `by_userId_dueAt`, bounded above by the end of the window; the
 * result set is at most the user's verse-memory corpus (same bound as
 * `memoryStats`).
 */
export const reviewForecast = query({
  args: { now: v.number(), days: v.optional(v.number()) },
  returns: v.array(dayCountValidator),
  handler: async (ctx, args) => {
    const days = normalizeDays(args.days);
    const todayStart = startOfUtcDay(args.now);
    const dayStarts: number[] = [];
    for (let i = 0; i < days; i += 1) {
      dayStarts.push(todayStart + i * DAY_MS);
    }

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return dayStarts.map((dayStart) => ({ dayStart, count: 0 }));
    }

    const windowEnd = todayStart + days * DAY_MS;
    const rows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_dueAt", (q) =>
        q.eq("userId", userId).lt("dueAt", windowEnd),
      )
      .collect();

    const dueAts: number[] = [];
    for (const row of rows) {
      if (row.status === "suspended") continue;
      dueAts.push(row.dueAt);
    }

    const counts = bucketForecastCounts(dueAts, args.now, days);
    return dayStarts.map((dayStart, i) => ({ dayStart, count: counts[i] }));
  },
});

const masteryDistributionValidator = v.object({
  new: v.number(),
  learning: v.number(),
  reviewing: v.number(),
  mastered: v.number(),
  suspended: v.number(),
  total: v.number(),
});

/** Counts of verses by lifecycle status for the current user. */
export const masteryDistribution = query({
  args: { now: v.number() },
  returns: masteryDistributionValidator,
  handler: async (ctx) => {
    const empty = {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
      suspended: 0,
      total: 0,
    };

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return empty;
    }

    const rows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId))
      .collect();

    const stats = { ...empty };
    for (const row of rows) {
      stats[row.status] += 1;
      stats.total += 1;
    }
    return stats;
  },
});
