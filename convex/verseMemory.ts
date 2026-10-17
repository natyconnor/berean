import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  findVerseMemory,
  isInMemory,
  adjustUserMemoryStats,
  findSavedVerse,
  requireInMemory,
} from "./lib/verseMemory";
import {
  countDueUnifiedReviewPacks,
  dueUnifiedPackDueAt,
  loadPackMembershipIndex,
  loadUnifiedReviewPacks,
  loadUnifiedReviewVerseRefIds,
  loadVersePackLabels,
  unifiedPackForecastDueAt,
  unifiedReviewPhaseVerseRefIds,
  type PackMember,
  type VersePackLabel,
} from "./lib/packs";
import { loadPassageDueRecords } from "./lib/passageDue";
import { loadPackUpNext } from "./lib/packUpNext";
import {
  loadMemorizeStartStatus,
  loadMemorizeStatusForSpans,
  memorizeSpan,
  memorizeStatusReader,
  stopMemorizingVerse,
} from "./lib/memorize";
import { MEMORIZE_STATUS_MAX_TARGETS } from "../src/lib/memorize-status";
import {
  backfillInMemoryForUser,
  hasInMemoryBackfill,
} from "./lib/inMemoryBackfill";
import { sortByVerseRef } from "../shared/compare-verse-refs";
import {
  MAX_REVIEW_ACTIVITY_ROWS,
  ensureReviewActivityDays as backfillReviewActivityDaysIfNeeded,
  loadBackfilledReviewDays,
  noteVerseReviewForActivity,
} from "./lib/reviewActivityDays";
import {
  toReviewingPassagePackItem,
  withNormalizedPieces,
  type DueQueuePassagePackItem,
} from "./lib/passageMemory";
import { dueQueuePackItemValidator } from "./lib/passageValues";
import { findVerseRefId } from "./lib/verseRefs";
import {
  dueIndexUntil,
  isDueForLearning,
  isDueForLibrary,
  isDueForReview,
  isLearningLocked,
  isReviewPhase,
  holdReviewingInterval,
  scheduleNext,
  type MemorySchedule,
} from "../src/lib/memory-scheduler";
import {
  countDuePassageReviews,
  countProjectedPassageLearning,
  isPassageDueForReview,
} from "../src/lib/passage-due";
import {
  bucketForecastCounts,
  normalizeTimeZone,
  reviewActivityFromDayAggregates,
  reviewActivityFromLogs,
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
/** Cap how many due-index rows we scan when filling a limited queue / count. */
const MAX_DUE_SCAN = 500;

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
  isHearted: v.optional(v.boolean()),
  inMemory: v.optional(v.boolean()),
  lastReviewedAt: v.optional(v.number()),
  createdAt: v.number(),
});

/** A due row joined to its resolved verse reference. */
const dueQueueVerseItem = v.object({
  kind: v.literal("verse"),
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

/** One recitation card for a unified or reviewing passage pack. */
export const dueQueuePackItem = dueQueuePackItemValidator;

const dueQueueEntry = v.union(dueQueueVerseItem, dueQueuePackItem);

/** A verse-scoped due row (no pack card). */
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

const MAX_UNIFIED_DUE_SCAN = 2000;

function dueScanCap(limit: number, unifiedMemberCount: number): number {
  return Math.min(
    MAX_UNIFIED_DUE_SCAN,
    Math.max(MAX_DUE_SCAN, unifiedMemberCount + Math.max(limit * 4, limit)),
  );
}

function toDueQueueVerseItem(row: Doc<"verseMemory">, ref: Doc<"verseRefs">) {
  return {
    kind: "verse" as const,
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
  };
}

function toDueQueuePackItem(
  pack: Doc<"packs">,
  members: readonly PackMember[],
  dueAt: number,
) {
  const lead = members.find((member) => member.dueAt === dueAt) ?? members[0];
  if (!lead) return null;
  return {
    kind: "pack" as const,
    packId: pack._id,
    packName: pack.name,
    dueAt,
    status: lead.status,
    learnStage: lead.learnStage,
    stageReps: lead.stageReps,
    ease: lead.ease,
    intervalDays: lead.intervalDays,
    consecutiveCorrect: lead.consecutiveCorrect,
    lapses: lead.lapses,
    earlyReviewApplied: lead.earlyReviewApplied,
    lastReviewedAt: lead.lastReviewedAt,
    members: members.map((member) => ({
      book: member.book,
      chapter: member.chapter,
      startVerse: member.startVerse,
      endVerse: member.endVerse,
    })),
  };
}

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
    isHearted: row.isHearted,
    inMemory: row.inMemory,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Verses due for review at `now` (soonest first), joined to their verse ref.
 *
 * Only `reviewing` / `mastered` verses with `dueAt <= now` qualify — learning-
 * phase verses are practiced from the verse detail / learn flow, not the review
 * queue. Only in-Memory rows are returned. A verse that stops memorizing keeps
 * its `verseMemory` row as durable history, but drops out of the live due
 * queue until it is memorized again.
 * `now` is passed in by the caller so the query stays deterministic/cacheable.
 *
 * Unified packs are one card: their review-phase members are skipped as verse
 * rows and the pack is inserted as a single item, sorted by dueAt with the
 * rest of the queue. Scan overscan grows with unified membership so skipping
 * those rows cannot starve other dues.
 *
 * Reviewing/mastered `passageMemory` rows are also one pack card, with
 * `members` from frozen pieces. Building passages are not review-due.
 * In-Memory verses a passage did not absorb (they are in a custom pack) stay
 * in this verse scan — they are not added to `unifiedReviewPhaseVerseRefIds`
 * (the unified flag is cleared on start, and packs with a passage row are
 * excluded from that set).
 */
export const dueQueue = query({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
    /**
     * Client cache key only. Review passes a new value when "Keep reviewing"
     * re-subscribes after skipping this query, so the next snapshot is not a
     * stale skipped result. The handler ignores it.
     */
    generation: v.optional(v.number()),
  },
  returns: v.array(dueQueueEntry),
  handler: async (ctx, args) => {
    void args.generation;
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit ?? DEFAULT_DUE_LIMIT;
    const passageRows = await loadPassageDueRecords(ctx, userId, args.now);
    const passagePackIds = new Set(passageRows.map((row) => row.packId));
    const unifiedPacks = await loadUnifiedReviewPacks(
      ctx,
      userId,
      passagePackIds,
    );
    const unifiedVerseRefIds = unifiedReviewPhaseVerseRefIds(unifiedPacks);
    const scanCap = dueScanCap(limit, unifiedVerseRefIds.size);

    const dueRows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_inMemory_dueAt", (q) =>
        q.eq("userId", userId).eq("inMemory", true).lte("dueAt", args.now),
      )
      .order("asc")
      .take(scanCap);

    const verseItems: Array<ReturnType<typeof toDueQueueVerseItem>> = [];
    for (const row of dueRows) {
      // `limit` verses plus every due pack is enough for the merge: packs only
      // insert into the earliest slots, they never require verses further down.
      if (verseItems.length >= limit) break;
      if (unifiedVerseRefIds.has(row.verseRefId)) continue;
      if (!isDueForReview(row, args.now)) continue;

      const ref = await ctx.db.get(row.verseRefId);
      if (!ref || ref.userId !== userId) continue;
      verseItems.push(toDueQueueVerseItem(row, ref));
    }

    const packItems: Array<
      | NonNullable<ReturnType<typeof toDueQueuePackItem>>
      | DueQueuePassagePackItem
    > = [];
    for (const { pack, members } of unifiedPacks) {
      const dueAt = dueUnifiedPackDueAt(members, args.now);
      if (dueAt === null) continue;
      const item = toDueQueuePackItem(pack, members, dueAt);
      if (item) packItems.push(item);
    }

    for (const projected of passageRows) {
      if (!isPassageDueForReview(projected, args.now)) continue;
      const row = await ctx.db.get(projected.passageMemoryId);
      if (!row || row.userId !== userId) continue;
      const pack = await ctx.db.get(row.packId);
      if (!pack || pack.userId !== userId) continue;
      const item = toReviewingPassagePackItem(pack, withNormalizedPieces(row));
      if (item) packItems.push(item);
    }

    return [...verseItems, ...packItems]
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, limit);
  },
});

/**
 * Resolve a single in-Memory verse for a scoped review session.
 *
 * Unlike the global due queue, a verse-scoped deep link may start a one-off
 * early review: any live `reviewing` / `mastered` row qualifies, even when
 * `dueAt > now`. The scheduler still applies its once-per-interval early-boost
 * rules when the attempt is recorded. `now` is accepted so callers can share
 * the same live clock as other memory queries (cache key parity).
 */
export const dueForVerse = query({
  args: {
    now: v.number(),
    book: v.string(),
    chapter: v.number(),
    startVerse: v.number(),
    endVerse: v.number(),
  },
  returns: v.union(dueQueueItem, v.null()),
  handler: async (ctx, args) => {
    // Kept for caller cache-key parity with dueQueue / pack resolve; eligibility
    // below is review-phase, not dueAt (scoped one-off / early reviews).
    void args.now;

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const verseRefId = await findVerseRefId(ctx, userId, {
      book: args.book,
      chapter: args.chapter,
      startVerse: args.startVerse,
      endVerse: args.endVerse,
    });
    if (!verseRefId) return null;

    const memory = await findVerseMemory(ctx, userId, verseRefId);
    if (!memory || !isInMemory(memory)) return null;
    if (!isReviewPhase(memory.status)) return null;

    const unifiedVerseRefIds = await loadUnifiedReviewVerseRefIds(ctx, userId);
    if (unifiedVerseRefIds.has(verseRefId)) return null;

    const ref = await ctx.db.get(verseRefId);
    if (!ref || ref.userId !== userId) return null;

    return {
      _id: memory._id,
      verseRefId: memory.verseRefId,
      status: memory.status,
      learnStage: memory.learnStage,
      stageReps: memory.stageReps,
      ease: memory.ease,
      intervalDays: memory.intervalDays,
      dueAt: memory.dueAt,
      consecutiveCorrect: memory.consecutiveCorrect,
      lapses: memory.lapses,
      earlyReviewApplied: memory.earlyReviewApplied,
      lastReviewedAt: memory.lastReviewedAt,
      createdAt: memory.createdAt,
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    };
  },
});

/**
 * Cheap count of verses due *today* — review-phase dues, in-progress learning
 * verses whose session is available, and pack Up-next verses joining learning
 * today (`loadPackUpNext`). Other `new` verses and soft-locked learning are
 * excluded. Drives the dock badge. Bounded scan — not a full collect. Shares
 * the same `now` snapshot as the dashboard.
 *
 * The due-index upper bound is {@link dueIndexUntil} rather than `now`:
 * in-progress learning can stamp `dueAt` with a live clock while this query
 * uses a frozen session `now`. Session locks are still excluded by
 * {@link isDueForLearning}.
 */
export const dueCount = query({
  args: { now: v.number(), tzOffsetMinutes: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return 0;
    }

    const dueRows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_inMemory_dueAt", (q) =>
        q
          .eq("userId", userId)
          .eq("inMemory", true)
          .lte("dueAt", dueIndexUntil(args.now)),
      )
      .order("asc")
      .take(MAX_DUE_SCAN);

    const tzOffsetMinutes = args.tzOffsetMinutes ?? 0;
    const passageRows = await loadPassageDueRecords(ctx, userId, args.now);
    const passagePackIds = new Set(passageRows.map((row) => row.packId));
    const unifiedPacks = await loadUnifiedReviewPacks(
      ctx,
      userId,
      passagePackIds,
    );
    const unifiedReviewVerseRefIds =
      unifiedReviewPhaseVerseRefIds(unifiedPacks);
    const upNext = await loadPackUpNext(ctx, userId);

    let count = upNext.members.length;
    for (const row of dueRows) {
      if (isDueForLearning(row, args.now)) {
        count += 1;
        continue;
      }
      if (
        isDueForReview(row, args.now) &&
        !unifiedReviewVerseRefIds.has(row.verseRefId)
      ) {
        count += 1;
      }
    }
    return (
      count +
      countDueUnifiedReviewPacks(unifiedPacks, args.now) +
      countDuePassageReviews(passageRows, args.now) +
      countProjectedPassageLearning(passageRows, args.now, tzOffsetMinutes)
    );
  },
});

/**
 * Log a graded attempt and reschedule the verse in one atomic mutation.
 *
 * Appends a `verseMemoryReviews` row, applies the pure `scheduleNext` to the
 * verse's in-Memory `verseMemory` row, and patches it. Returns the new
 * schedule so callers can reflect the updated `dueAt`/status immediately.
 * Throws when the verse is not in Memory.
 *
 * Soft-locked learning verses (`dueAt` in the future) do not advance: the
 * mutation returns the current schedule without writing a review or patch.
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
    /** Client `getTimezoneOffset()`; lands learning soft locks on their day. */
    tzOffsetMinutes: v.optional(v.number()),
    /** IANA zone for Practice heatmap day buckets; same as `reviewActivity`. */
    timeZone: v.optional(v.string()),
  },
  returns: memoryScheduleValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) {
      throw new Error("Verse reference not found");
    }

    const memory = await requireInMemory(ctx, userId, args.verseRefId);

    if (isReviewPhase(memory.status)) {
      const unifiedVerseRefIds = await loadUnifiedReviewVerseRefIds(
        ctx,
        userId,
      );
      if (unifiedVerseRefIds.has(args.verseRefId)) {
        throw new Error(
          "This verse is part of a pack recited as one passage. Review it from the pack.",
        );
      }
    }

    const current: MemorySchedule = {
      status: memory.status,
      learnStage: memory.learnStage,
      stageReps: memory.stageReps ?? 0,
      ease: memory.ease,
      intervalDays: memory.intervalDays,
      dueAt: memory.dueAt,
      consecutiveCorrect: memory.consecutiveCorrect,
      lapses: memory.lapses,
      earlyReviewApplied: memory.earlyReviewApplied ?? false,
    };

    // Soft lock: today's learning session is done — refuse to bank more reps.
    if (
      isLearningLocked(
        { ...current, lastReviewedAt: memory.lastReviewedAt },
        args.now,
      )
    ) {
      return current;
    }

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

    if (args.timeZone) {
      await noteVerseReviewForActivity(ctx, {
        userId,
        createdAt: args.now,
        accuracy: args.accuracy,
        mode: args.mode,
        stage: args.stage,
        timeZone: args.timeZone,
      });
    }

    const next = scheduleNext(current, {
      quality: args.quality,
      accuracy: args.accuracy,
      mode: args.mode,
      now: args.now,
      wordCount: args.wordCount,
      tzOffsetMinutes: args.tzOffsetMinutes,
    });

    if (memory.status !== next.status) {
      await adjustUserMemoryStats(
        ctx,
        userId,
        args.now,
        memory.status,
        next.status,
      );
    }

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

/**
 * Spend a review-phase verse after the learner declines an 80%+ retry.
 * Holds the current interval without logging another recitation — the close
 * attempt was already recorded.
 */
export const acceptRetryHold = mutation({
  args: {
    verseRefId: v.id("verseRefs"),
    now: v.number(),
    tzOffsetMinutes: v.optional(v.number()),
  },
  returns: memoryScheduleValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) {
      throw new Error("Verse reference not found");
    }

    const memory = await requireInMemory(ctx, userId, args.verseRefId);

    const current: MemorySchedule = {
      status: memory.status,
      learnStage: memory.learnStage,
      stageReps: memory.stageReps ?? 0,
      ease: memory.ease,
      intervalDays: memory.intervalDays,
      dueAt: memory.dueAt,
      consecutiveCorrect: memory.consecutiveCorrect,
      lapses: memory.lapses,
      earlyReviewApplied: memory.earlyReviewApplied ?? false,
    };

    if (!isReviewPhase(current.status)) return current;

    const unifiedVerseRefIds = await loadUnifiedReviewVerseRefIds(ctx, userId);
    if (unifiedVerseRefIds.has(args.verseRefId)) {
      throw new Error(
        "This verse is part of a pack recited as one passage. Review it from the pack.",
      );
    }

    const next = holdReviewingInterval(current, args.now, args.tzOffsetMinutes);

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

/**
 * The verse's memory row, memorizing it first (see `memorizeSpan`) when it is
 * not in Memory yet. Idempotent for a verse already in Memory.
 */
export const getOrCreateForVerse = mutation({
  args: { verseRefId: v.id("verseRefs"), now: v.number() },
  returns: verseMemoryValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) {
      throw new Error("Verse reference not found");
    }

    const existing = await findVerseMemory(ctx, userId, args.verseRefId);
    if (existing && isInMemory(existing)) return toRowView(existing);

    await memorizeSpan(ctx, userId, ref, args.now, { upNext: false });
    const memory = await findVerseMemory(ctx, userId, args.verseRefId);
    if (!memory) throw new Error("Failed to create verse memory row");
    return toRowView(memory);
  },
});

const MAX_MEMORIZE_SPANS = 50;

const memorizeSpanValidator = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

/**
 * Put spans in Memory on their own: each starts learning, due now, and gets a
 * heart when no existing heart covers it. A span already in Memory is left as
 * is, so repeat calls are no-ops. `added` counts spans that were added,
 * resumed, or promoted from Up next; `verseRefIds` follows the order of
 * `spans`.
 */
export const memorize = mutation({
  args: {
    spans: v.array(memorizeSpanValidator),
    now: v.number(),
  },
  returns: v.object({
    added: v.number(),
    alreadyMemorizing: v.number(),
    verseRefIds: v.array(v.id("verseRefs")),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    if (args.spans.length === 0 || args.spans.length > MAX_MEMORIZE_SPANS) {
      throw new Error(
        `Memorize between 1 and ${MAX_MEMORIZE_SPANS} verses at a time.`,
      );
    }

    let added = 0;
    let alreadyMemorizing = 0;
    const verseRefIds: Id<"verseRefs">[] = [];
    for (const span of args.spans) {
      const { verseRefId, result } = await memorizeSpan(
        ctx,
        userId,
        span,
        args.now,
        { upNext: false },
      );
      verseRefIds.push(verseRefId);
      if (result === "already") {
        alreadyMemorizing += 1;
      } else {
        added += 1;
      }
    }

    return { added, alreadyMemorizing, verseRefIds };
  },
});

const memorizeDestinationValidator = v.union(
  v.object({
    kind: v.literal("verse"),
    verseRefId: v.id("verseRefs"),
    span: memorizeSpanValidator,
  }),
  v.object({ kind: v.literal("pack"), packId: v.id("packs") }),
);

const memorizeStatusValidator = v.object({
  state: v.union(
    v.literal("none"),
    v.literal("memorizing"),
    v.literal("partOf"),
    v.literal("overlaps"),
  ),
  title: v.optional(v.string()),
  destination: v.optional(memorizeDestinationValidator),
  allHearted: v.boolean(),
  progress: v.optional(
    v.union(
      v.literal("upNext"),
      v.literal("notStarted"),
      v.literal("learning"),
      v.literal("memorized"),
      v.literal("mastered"),
    ),
  ),
  upNextPackName: v.optional(v.string()),
  carriedOver: v.optional(
    v.array(
      v.object({
        book: v.string(),
        chapter: v.number(),
        startVerse: v.number(),
        endVerse: v.number(),
        memorized: v.boolean(),
      }),
    ),
  ),
});

/**
 * Whether the user already memorizes these spans (alone, as a passage, or as a
 * custom pack) or a passage they memorize contains them, and whether hearts
 * already cover every span. See `loadMemorizeStatus`; the exact verse also
 * says where it stands (`progress`, `upNextPackName`). Signed out, or with no
 * or too many spans, reads as not memorizing and not hearted. A target that
 * would start fresh also lists the verses inside it whose progress carries
 * over (`carriedOver`, see `loadMemorizeStartStatus`).
 */
export const memorizeStatus = query({
  args: { spans: v.array(memorizeSpanValidator) },
  returns: memorizeStatusValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return { state: "none" as const, allHearted: false };
    return await loadMemorizeStartStatus(ctx, userId, args.spans);
  },
});

/**
 * {@link memorizeStatus} for up to `MEMORIZE_STATUS_MAX_TARGETS` targets at
 * once, in order, sharing hearts and passage reads across them.
 */
export const memorizeStatuses = query({
  args: {
    targets: v.array(v.object({ spans: v.array(memorizeSpanValidator) })),
  },
  returns: v.array(memorizeStatusValidator),
  handler: async (ctx, args) => {
    if (args.targets.length > MEMORIZE_STATUS_MAX_TARGETS) {
      throw new Error(
        `Check at most ${MEMORIZE_STATUS_MAX_TARGETS} targets at once`,
      );
    }
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return args.targets.map(() => ({
        state: "none" as const,
        allHearted: false,
      }));
    }
    const reader = memorizeStatusReader(ctx, userId);
    const statuses = [];
    for (const target of args.targets) {
      statuses.push(
        await loadMemorizeStatusForSpans(ctx, userId, target.spans, reader),
      );
    }
    return statuses;
  },
});

/**
 * Take a verse out of Memory. The heart, schedule, and review history stay,
 * so memorizing it again resumes where it left off.
 */
export const stopMemorizing = mutation({
  args: { verseRefId: v.id("verseRefs"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const ref = await ctx.db.get(args.verseRefId);
    if (!ref || ref.userId !== userId) {
      throw new Error("Verse reference not found");
    }

    await stopMemorizingVerse(ctx, userId, args.verseRefId, args.now);
    return null;
  },
});

/** A verse in Memory with its schedule and the packs that list it. */
const inMemoryVerseItemValidator = v.object({
  verseRefId: v.id("verseRefs"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  memory: v.object({
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
  }),
  packIds: v.array(v.id("packs")),
});

function toInMemoryVerseItem(
  memory: Pick<
    Doc<"verseMemory">,
    | "verseRefId"
    | "status"
    | "learnStage"
    | "stageReps"
    | "ease"
    | "intervalDays"
    | "dueAt"
    | "consecutiveCorrect"
    | "lapses"
    | "earlyReviewApplied"
    | "lastReviewedAt"
  >,
  ref: Pick<Doc<"verseRefs">, "book" | "chapter" | "startVerse" | "endVerse">,
  packIds: Id<"packs">[],
) {
  return {
    verseRefId: memory.verseRefId,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
    memory: {
      status: memory.status,
      learnStage: memory.learnStage,
      stageReps: memory.stageReps,
      ease: memory.ease,
      intervalDays: memory.intervalDays,
      dueAt: memory.dueAt,
      consecutiveCorrect: memory.consecutiveCorrect,
      lapses: memory.lapses,
      earlyReviewApplied: memory.earlyReviewApplied,
      lastReviewedAt: memory.lastReviewedAt,
    },
    packIds,
  };
}

/**
 * Every verse the user is memorizing, in Bible order. Session pages snapshot
 * this (a `verseMemory` patch re-runs it), so do not subscribe to it live
 * while recording attempts.
 */
export const listInMemory = query({
  args: {},
  returns: v.array(inMemoryVerseItemValidator),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const [memories, packIndex] = await Promise.all([
      ctx.db
        .query("verseMemory")
        .withIndex("by_userId_inMemory", (q) =>
          q.eq("userId", userId).eq("inMemory", true),
        )
        .collect(),
      loadPackMembershipIndex(ctx, userId),
    ]);

    const items = await Promise.all(
      memories.map(async (memory) => {
        const ref = await ctx.db.get(memory.verseRefId);
        if (!ref || ref.userId !== userId) return null;
        return toInMemoryVerseItem(
          memory,
          ref,
          packIndex.packIdsFor(memory.verseRefId),
        );
      }),
    );
    return sortByVerseRef(
      items.filter(
        (item): item is ReturnType<typeof toInMemoryVerseItem> => item !== null,
      ),
    );
  },
});

/** Bound on the in-progress `learning` rows one learn queue reads. */
const MAX_LEARN_QUEUE_LEARNING_ROWS = 500;

/**
 * Today's verse learning: unlocked `learning` rows, then the pack Up-next
 * verses that join learning now (`loadPackUpNext`). Each group is in Bible
 * order. Up-next items keep status `new`; their first attempt moves them to
 * `learning`. Session pages snapshot this like {@link listInMemory}.
 */
export const learnQueue = query({
  args: { now: v.number(), tzOffsetMinutes: v.optional(v.number()) },
  returns: v.array(inMemoryVerseItemValidator),
  handler: async (ctx, args) => {
    // Cache-key parity with `passageMemory.dueForLearning`; verse learning
    // availability does not depend on the local day.
    void args.tzOffsetMinutes;

    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const [learningRows, upNext, packIndex] = await Promise.all([
      ctx.db
        .query("verseMemory")
        .withIndex("by_userId_inMemory_status", (q) =>
          q.eq("userId", userId).eq("inMemory", true).eq("status", "learning"),
        )
        .take(MAX_LEARN_QUEUE_LEARNING_ROWS),
      loadPackUpNext(ctx, userId),
      loadPackMembershipIndex(ctx, userId),
    ]);

    const learning = await Promise.all(
      learningRows
        .filter((row) => isDueForLearning(row, args.now))
        .map(async (row) => {
          const ref = await ctx.db.get(row.verseRefId);
          if (!ref || ref.userId !== userId) return null;
          return toInMemoryVerseItem(
            row,
            ref,
            packIndex.packIdsFor(row.verseRefId),
          );
        }),
    );
    const upNextItems = upNext.members.map((member) =>
      toInMemoryVerseItem(
        member,
        member,
        packIndex.packIdsFor(member.verseRefId),
      ),
    );

    return [
      ...sortByVerseRef(
        learning.filter(
          (item): item is ReturnType<typeof toInMemoryVerseItem> =>
            item !== null,
        ),
      ),
      ...sortByVerseRef(upNextItems),
    ];
  },
});

/** One in-Memory verse for a verse-scoped Learn / Practice URL, or `null`. */
export const getInMemory = query({
  args: {
    book: v.string(),
    chapter: v.number(),
    startVerse: v.number(),
    endVerse: v.number(),
  },
  returns: v.union(inMemoryVerseItemValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const verseRefId = await findVerseRefId(ctx, userId, args);
    if (!verseRefId) return null;

    const memory = await findVerseMemory(ctx, userId, verseRefId);
    if (!memory || !isInMemory(memory)) return null;

    const ref = await ctx.db.get(verseRefId);
    if (!ref || ref.userId !== userId) return null;

    const packIndex = await loadPackMembershipIndex(ctx, userId, verseRefId);
    return toInMemoryVerseItem(memory, ref, packIndex.packIdsFor(verseRefId));
  },
});

/**
 * Derive `inMemory` for the signed-in user's existing memory rows (see
 * `backfillInMemoryForUser`). The app calls this once per session; it is a
 * no-op once `userMemoryStats.inMemoryBackfilledAt` is set.
 */
export const ensureInMemoryBackfill = mutation({
  args: { now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (await hasInMemoryBackfill(ctx, userId)) return null;
    await backfillInMemoryForUser(ctx, userId, args.now);
    return null;
  },
});

const memoryStatusValidator = v.object({
  new: v.number(),
  learning: v.number(),
  reviewing: v.number(),
  mastered: v.number(),
  total: v.number(),
});

const memoryStatsValidator = v.object({
  new: v.number(),
  learning: v.number(),
  reviewing: v.number(),
  mastered: v.number(),
  total: v.number(),
  due: v.number(),
  learningDue: v.number(),
});

const EMPTY_MEMORY_STATUS = {
  new: 0,
  learning: 0,
  reviewing: 0,
  mastered: 0,
  total: 0,
};

/**
 * In-Memory status totals from `userMemoryStats` (O(1)). Pre-backfill
 * fallback counts in-Memory `verseMemory` rows once. Does not scan dues,
 * packs, or `passageMemory`.
 */
async function loadMemoryStatus(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{
  new: number;
  learning: number;
  reviewing: number;
  mastered: number;
  total: number;
}> {
  const rollup = await ctx.db
    .query("userMemoryStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (rollup) {
    return {
      new: rollup.new,
      learning: rollup.learning,
      reviewing: rollup.reviewing,
      mastered: rollup.mastered,
      total: rollup.total,
    };
  }

  // Pre-backfill fallback: count from in-Memory rows once.
  const rows = await ctx.db
    .query("verseMemory")
    .withIndex("by_userId_inMemory", (q) =>
      q.eq("userId", userId).eq("inMemory", true),
    )
    .take(MAX_DUE_SCAN);
  const stats = { ...EMPTY_MEMORY_STATUS };
  for (const memory of rows) {
    stats[memory.status] += 1;
    stats.total += 1;
  }
  return stats;
}

/**
 * Per-status in-Memory verse totals for Mastery, Practice All, and seed
 * `heartedTotal`. O(1) from `userMemoryStats` — does not load due scans,
 * unified packs, or passage rows.
 */
export const memoryStatus = query({
  args: {},
  returns: memoryStatusValidator,
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return EMPTY_MEMORY_STATUS;
    }
    return await loadMemoryStatus(ctx, userId);
  },
});

/**
 * Per-status counts for the current user, plus due-now tallies:
 * - `due` — review-phase verses (`reviewing` / `mastered` with `dueAt <= now`)
 *   plus due reviewing/mastered passage packs (1 each)
 * - `learningDue` — in-progress `learning` verses available for today's
 *   session, plus pack Up-next verses joining learning today
 *   (`loadPackUpNext`), plus building
 *   passage packs with a learning session today (1 each). Soft-locked
 *   frontier with no remaining introduces does not inflate this count (rope
 *   practice stays available from the pack). Same {@link dueIndexUntil} bound
 *   as {@link dueCount} so a frozen query clock does not hide a verse the
 *   learner is still working through. Pass `tzOffsetMinutes` so introduce
 *   budget uses the viewer's local day.
 *
 * Status totals come from denormalized `userMemoryStats` (O(1)). Due counts are
 * still computed live from a bounded due-index scan (time-dependent). Dashboard
 * Mastery / in-memory KPIs should subscribe to {@link memoryStatus} instead so
 * they do not wait on this due half.
 */
export const memoryStats = query({
  args: { now: v.number(), tzOffsetMinutes: v.optional(v.number()) },
  returns: memoryStatsValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return { ...EMPTY_MEMORY_STATUS, due: 0, learningDue: 0 };
    }

    const status = await loadMemoryStatus(ctx, userId);

    const dueRows = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_inMemory_dueAt", (q) =>
        q
          .eq("userId", userId)
          .eq("inMemory", true)
          .lte("dueAt", dueIndexUntil(args.now)),
      )
      .order("asc")
      .take(MAX_DUE_SCAN);

    const tzOffsetMinutes = args.tzOffsetMinutes ?? 0;
    const passageRows = await loadPassageDueRecords(ctx, userId, args.now);
    const passagePackIds = new Set(passageRows.map((row) => row.packId));
    const unifiedPacks = await loadUnifiedReviewPacks(
      ctx,
      userId,
      passagePackIds,
    );
    const unifiedReviewVerseRefIds =
      unifiedReviewPhaseVerseRefIds(unifiedPacks);
    const upNext = await loadPackUpNext(ctx, userId);

    let due = 0;
    let learningDue = upNext.members.length;
    for (const row of dueRows) {
      if (isDueForReview(row, args.now)) {
        if (!unifiedReviewVerseRefIds.has(row.verseRefId)) due += 1;
      }
      if (isDueForLearning(row, args.now)) learningDue += 1;
    }
    due += countDueUnifiedReviewPacks(unifiedPacks, args.now);
    due += countDuePassageReviews(passageRows, args.now);
    learningDue += countProjectedPassageLearning(
      passageRows,
      args.now,
      tzOffsetMinutes,
    );

    return { ...status, due, learningDue };
  },
});

const dayCountValidator = v.object({
  dayStart: v.number(),
  count: v.number(),
});

const dayAccuracyValidator = v.object({
  dayStart: v.number(),
  average: v.union(v.number(), v.null()),
  count: v.number(),
});

/**
 * Per-day practice count and accuracy aggregates for the dashboard. Prefers
 * `userMemoryReviewDays` (~365 skinny rows) once that timezone is backfilled;
 * otherwise scans up to {@link MAX_REVIEW_ACTIVITY_ROWS} verse review logs.
 * Passage grades are not included (same as the log table).
 */
export const reviewActivity = query({
  args: {
    now: v.number(),
    timeZone: v.string(),
    heatmapDays: v.optional(v.number()),
    trendDays: v.optional(v.number()),
  },
  returns: v.object({
    heatmap: v.array(dayCountValidator),
    trend: v.array(dayAccuracyValidator),
  }),
  handler: async (ctx, args) => {
    const heatmapDays = normalizeDays(args.heatmapDays ?? 365);
    const trendDays = normalizeDays(args.trendDays ?? 30);
    const windowDays = Math.max(heatmapDays, trendDays);
    const timeZone = normalizeTimeZone(args.timeZone);
    const heatmapDayStarts = zonedDayStarts(args.now, heatmapDays, timeZone);
    const trendDayStarts = zonedDayStarts(args.now, trendDays, timeZone);
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return {
        heatmap: heatmapDayStarts.map((dayStart) => ({ dayStart, count: 0 })),
        trend: trendDayStarts.map((dayStart) => ({
          dayStart,
          average: null,
          count: 0,
        })),
      };
    }

    const windowStarts = zonedDayStarts(args.now, windowDays, timeZone);
    const windowStart = windowStarts[0];
    const stored = await loadBackfilledReviewDays(
      ctx,
      userId,
      timeZone,
      windowStart,
    );
    if (stored) {
      return reviewActivityFromDayAggregates(
        stored,
        heatmapDayStarts,
        trendDayStarts,
      );
    }

    const rows = await ctx.db
      .query("verseMemoryReviews")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", windowStart),
      )
      .take(MAX_REVIEW_ACTIVITY_ROWS);

    return reviewActivityFromLogs(
      rows.map((row) => ({
        createdAt: row.createdAt,
        accuracy: row.accuracy,
        mode: row.mode,
        stage: row.stage,
      })),
      args.now,
      heatmapDays,
      trendDays,
      timeZone,
    );
  },
});

/**
 * Build per-local-day heatmap/accuracy aggregates for this viewer timezone.
 * Idempotent. Dashboard calls this once so `reviewActivity` can stop scanning
 * the raw review log. Verse logs only — passage grades stay off the heatmap.
 */
export const ensureReviewActivityDays = mutation({
  args: { now: v.number(), timeZone: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await backfillReviewActivityDaysIfNeeded(
      ctx,
      userId,
      args.timeZone,
      args.now,
    );
    return null;
  },
});

/**
 * Count of review-phase verses due per upcoming day over the next `days`
 * (default 30). Learning-phase verses are excluded.
 *
 * Overdue verses are folded into today (day 0). Reads only in-Memory rows.
 * Day buckets use the viewer's IANA `timeZone`.
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
      .withIndex("by_userId_inMemory_dueAt", (q) =>
        q.eq("userId", userId).eq("inMemory", true).lt("dueAt", windowEnd),
      )
      .take(MAX_DUE_SCAN);

    const passageRows = await loadPassageDueRecords(ctx, userId, args.now);
    const passagePackIds = new Set(passageRows.map((row) => row.packId));
    const unifiedPacks = await loadUnifiedReviewPacks(
      ctx,
      userId,
      passagePackIds,
    );
    const unifiedReviewVerseRefIds =
      unifiedReviewPhaseVerseRefIds(unifiedPacks);

    const dueAts: number[] = [];
    for (const row of rows) {
      // Soft-locked learning verses have dueAt in the future and would appear
      // in the window; exclude them — forecast is review-phase only.
      if (!isReviewPhase(row.status)) continue;
      if (unifiedReviewVerseRefIds.has(row.verseRefId)) continue;
      dueAts.push(row.dueAt);
    }
    for (const { members } of unifiedPacks) {
      const dueAt = unifiedPackForecastDueAt(members);
      if (dueAt !== null && dueAt < windowEnd) dueAts.push(dueAt);
    }

    for (const row of passageRows) {
      if (row.status !== "reviewing" && row.status !== "mastered") continue;
      if (row.dueAt < windowEnd) dueAts.push(row.dueAt);
    }

    const counts = bucketForecastCounts(dueAts, args.now, days, timeZone);
    return dayStarts.map((dayStart, i) => ({ dayStart, count: counts[i] }));
  },
});

// ---------- Library + drill-down (PR 7) ----------

const libraryViewValidator = v.union(
  v.literal("due"),
  v.literal("learning"),
  v.literal("memorized"),
  v.literal("mastered"),
  v.literal("all"),
);

/**
 * One in-Memory verse: its live memory schedule joined to its reference.
 * `savedVerseId` / `heartedAt` are present when the verse has its own exact
 * heart (a wider or passage heart may cover it instead).
 */
const libraryItemValidator = v.object({
  verseMemoryId: v.id("verseMemory"),
  verseRefId: v.id("verseRefs"),
  savedVerseId: v.optional(v.id("savedVerses")),
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
  heartedAt: v.optional(v.number()),
  packs: v.array(
    v.object({
      packId: v.id("packs"),
      name: v.string(),
      kind: v.union(v.literal("pack"), v.literal("passage")),
    }),
  ),
});

type LibraryItem = {
  verseMemoryId: Id<"verseMemory">;
  verseRefId: Id<"verseRefs">;
  savedVerseId?: Id<"savedVerses">;
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
  heartedAt?: number;
  packs: VersePackLabel[];
};

function toLibraryItem(
  memory: Doc<"verseMemory">,
  ref: Doc<"verseRefs">,
  saved: Doc<"savedVerses"> | null,
  packs: VersePackLabel[],
): LibraryItem {
  return {
    verseMemoryId: memory._id,
    verseRefId: memory.verseRefId,
    savedVerseId: saved?._id,
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
    heartedAt: saved?.createdAt,
    packs,
  };
}

async function toLibraryItems(
  ctx: QueryCtx,
  userId: Id<"users">,
  memories: readonly Doc<"verseMemory">[],
  keep: (memory: Doc<"verseMemory">) => boolean,
): Promise<LibraryItem[]> {
  const kept = memories.filter((memory) => isInMemory(memory) && keep(memory));
  if (kept.length === 0) return [];
  const packsFor = await loadVersePackLabels(ctx, userId);
  const items: LibraryItem[] = [];
  for (const memory of kept) {
    const ref = await ctx.db.get(memory.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    const saved = await findSavedVerse(ctx, userId, memory.verseRefId);
    items.push(
      toLibraryItem(memory, ref, saved, packsFor(memory.verseRefId, ref)),
    );
  }
  return items;
}

async function toLibraryPage(
  ctx: QueryCtx,
  userId: Id<"users">,
  paginated: PaginationResult<Doc<"verseMemory">>,
  keep: (memory: Doc<"verseMemory">) => boolean,
): Promise<PaginationResult<LibraryItem>> {
  return {
    ...paginated,
    page: await toLibraryItems(ctx, userId, paginated.page, keep),
  };
}

/** Upper bound on each status read by the single-page `"learning"` view. */
const MAX_LIBRARY_LEARNING_ROWS = 500;

const emptyLibraryPage: PaginationResult<LibraryItem> = {
  page: [],
  isDone: true,
  continueCursor: "",
};

/**
 * A page of the user's in-Memory verses, each joined to its live memory
 * schedule and verse reference. Paginated via
 * `paginationOptsValidator`/`.paginate()`.
 *
 * `view` picks the index the page is read through so ordering is stable across
 * pages (never a cross-page in-memory sort):
 * - `"due"` — due review + unlocked learning (`by_userId_inMemory_dueAt` with
 *   `dueAt <= dueIndexUntil(now)`). Up-next `new` rows share that index and
 *   are skipped in-page via `isDueForLibrary`. Pass `now`; missing `now`
 *   returns an empty exhausted page (never `Date.now()`). The scan bound is
 *   wider than `now` so in-progress learning stamped ahead of a frozen
 *   session clock still appears until today's reps are finished.
 * - `"learning"` — `learning` then Up-next `new` rows, as one exhausted page
 *   (each status capped at {@link MAX_LIBRARY_LEARNING_ROWS}). The two
 *   statuses are not adjacent in the status index, so paging over the range
 *   between them would mostly read `mastered` rows.
 * - `"memorized"` — `reviewing` only (`by_userId_inMemory_status`).
 * - `"mastered"` — `mastered` only (`by_userId_inMemory_status`).
 * - `"all"` — every in-Memory row (`by_userId_inMemory_status`). Status-index
 *   order is alphabetical, not lifecycle or Bible order.
 */
export const listLibrary = query({
  args: {
    paginationOpts: paginationOptsValidator,
    view: libraryViewValidator,
    now: v.optional(v.number()),
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
      return emptyLibraryPage;
    }

    if (args.view === "due") {
      if (args.now === undefined) {
        return emptyLibraryPage;
      }
      const now = args.now;
      const unifiedVerseRefIds = await loadUnifiedReviewVerseRefIds(
        ctx,
        userId,
      );
      const paginated = await ctx.db
        .query("verseMemory")
        .withIndex("by_userId_inMemory_dueAt", (q) =>
          q
            .eq("userId", userId)
            .eq("inMemory", true)
            .lte("dueAt", dueIndexUntil(now)),
        )
        .order("asc")
        .paginate(args.paginationOpts);
      return await toLibraryPage(
        ctx,
        userId,
        paginated,
        (memory) =>
          isDueForLibrary(memory, now) &&
          !unifiedVerseRefIds.has(memory.verseRefId),
      );
    }

    if (args.view === "learning") {
      const byStatus = await Promise.all(
        (["learning", "new"] as const).map((status) =>
          ctx.db
            .query("verseMemory")
            .withIndex("by_userId_inMemory_status", (q) =>
              q.eq("userId", userId).eq("inMemory", true).eq("status", status),
            )
            .take(MAX_LIBRARY_LEARNING_ROWS),
        ),
      );
      return {
        page: await toLibraryItems(ctx, userId, byStatus.flat(), () => true),
        isDone: true,
        continueCursor: "",
      };
    }

    if (args.view === "memorized" || args.view === "mastered") {
      const status = args.view === "memorized" ? "reviewing" : "mastered";
      const paginated = await ctx.db
        .query("verseMemory")
        .withIndex("by_userId_inMemory_status", (q) =>
          q.eq("userId", userId).eq("inMemory", true).eq("status", status),
        )
        .paginate(args.paginationOpts);
      return await toLibraryPage(ctx, userId, paginated, () => true);
    }

    const paginated = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_inMemory_status", (q) =>
        q.eq("userId", userId).eq("inMemory", true),
      )
      .order("asc")
      .paginate(args.paginationOpts);
    return await toLibraryPage(ctx, userId, paginated, () => true);
  },
});

/** How many recent attempts the drill-down shows. */
const VERSE_DETAIL_ATTEMPT_LIMIT = 20;

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
  inMemory: v.boolean(),
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

    const saved = await findSavedVerse(ctx, userId, args.verseRefId);

    const attemptRows = await ctx.db
      .query("verseMemoryReviews")
      .withIndex("by_userId_verseRefId_createdAt", (q) =>
        q.eq("userId", userId).eq("verseRefId", args.verseRefId),
      )
      .order("desc")
      .take(VERSE_DETAIL_ATTEMPT_LIMIT);

    const attempts: Attempt[] = attemptRows.map((row) => ({
      quality: row.quality,
      accuracy: row.accuracy,
      stage: row.stage,
      mode: row.mode,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    }));

    return {
      verseRefId: args.verseRefId,
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
      isHearted: saved !== null,
      heartedAt: saved?.createdAt ?? null,
      inMemory: isInMemory(memory),
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
