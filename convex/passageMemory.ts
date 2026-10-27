import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  deletePassageAndReviews,
  findPassageByPackId,
  insertPassageMemory,
  insertPassageReview,
  loadPassageForPack,
  markPassageCelebrated,
  memberToHeart,
  memberToSchedule,
  patchPassageMemory,
  requireOwnedPack,
  requirePassageForPack,
  toBuildingPassagePackItem,
  toPassageSchedule,
  toPassageView,
  withNormalizedPieces,
} from "./lib/passageMemory";
import { celebrationPendingPatch } from "./lib/passageCelebration";
import {
  dueQueuePackItemValidator,
  passageAttemptKindValidator,
  passageViewValidator,
  pieceBaseValidator,
  qualityValidator,
} from "./lib/passageValues";
import {
  filterScopeMembers,
  loadCustomPackVerseRefIds,
  loadInMemoryMembers,
  loadPassageMemoryByUser,
} from "./lib/packs";
import {
  ensurePassageDueBackfill,
  loadPassageDueRecords,
} from "./lib/passageDue";
import { ensurePassageHearts, stopMemorizingVerse } from "./lib/memorize";
import {
  holdReviewingInterval,
  nextStartOverUndo,
  refreshSchedule,
  SHORT_VERSE_WORDS,
} from "../src/lib/memory-scheduler";
import {
  isReviewHintedCheckIn,
  isShakyVerse,
  isStaleVerse,
  recentReviewLapsed,
  refreshRecentLapseCount,
} from "../src/lib/memory-stale";
import {
  startOverPassagePieces,
  startOverPassageSession,
} from "../src/lib/memory-start-over";
import {
  packAllowsPassageMode,
  rangeAllowsPassageMode,
} from "../src/lib/passage-eligibility";
import {
  isPassageDueForLearning,
  isProjectedPassageDueForLearning,
} from "../src/lib/passage-due";
import {
  localDayIndex,
  progressFrontierPieces,
  remainingIntroduces,
} from "../src/lib/passage-frontier";
import {
  absorbedVerseItems,
  assertPiecesMatchScope,
  findOverlappingPassage,
  freshReviewingSchedule,
  planStart,
} from "../src/lib/passage-start";
import { applyUnifiedGrade } from "../src/lib/unified-review-schedule";

/**
 * Passage-mode overlay on a pack. Returns `null` when the caller is
 * unauthenticated, the pack is missing or unowned, or no passage row exists.
 */
export const getForPack = query({
  args: {
    packId: v.string(),
    now: v.number(),
    tzOffsetMinutes: v.number(),
  },
  returns: v.union(passageViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const packId = ctx.db.normalizeId("packs", args.packId);
    if (!packId) return null;

    const row = await loadPassageForPack(ctx, packId, userId);
    if (!row) return null;

    return toPassageView(row, args.now, args.tzOffsetMinutes);
  },
});

/**
 * Explicit opt-in. Idempotent if a passage row already exists. Otherwise
 * freezes client-supplied pieces (seeded from the in-Memory members' progress;
 * a pack with `passageRange` has only members inside it, and its pieces must
 * cover it exactly), writes one passage heart per chapter over the pieces'
 * verses, absorbs standalone verse items inside the passage, and clears
 * unified recitation. Never unhearts anything. Does not run on pack open
 * alone.
 */
export const start = mutation({
  args: {
    packId: v.id("packs"),
    pieces: v.array(pieceBaseValidator),
    now: v.number(),
    tzOffsetMinutes: v.number(),
    timeZone: v.optional(v.string()),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await requireOwnedPack(ctx, args.packId, userId);

    const existing = await findPassageByPackId(ctx, pack._id);
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error("Passage mode is not available for this pack");
      }
      return toPassageView(existing, args.now, args.tzOffsetMinutes);
    }

    const range = pack.passageRange ?? null;
    if (
      pack.kind !== "scope" ||
      !pack.scope ||
      !packAllowsPassageMode(pack.scope) ||
      (range !== null && !rangeAllowsPassageMode(range))
    ) {
      throw new Error("This pack can't be learned as a passage");
    }

    assertPiecesMatchScope(args.pieces, pack.scope, range);

    const overlapping = findOverlappingPassage(
      args.pieces,
      (await loadPassageMemoryByUser(ctx, userId)).filter(
        (passage) => passage.packId !== pack._id,
      ),
    );
    if (overlapping) {
      const other = await ctx.db.get(overlapping.packId);
      throw new Error(
        other
          ? `This overlaps ${other.name}, which you're memorizing. Stop it first.`
          : "This overlaps a passage you're memorizing. Stop it first.",
      );
    }

    // In-Memory verses already inside the range carry their progress over.
    const members = filterScopeMembers(
      await loadInMemoryMembers(ctx, userId),
      pack.scope,
      pack.passageRange,
    );
    const plan = planStart({
      pieces: args.pieces,
      hearts: members.map(memberToHeart),
      scope: pack.scope,
      unifiedEnabled: pack.unifiedReviewEnabled === true,
      memberSchedules: members.map(memberToSchedule),
      now: args.now,
      tzOffsetMinutes: args.tzOffsetMinutes,
      timeZone: args.timeZone,
    });

    // Re-check before side effects / insert to collapse concurrent starts.
    const raced = await findPassageByPackId(ctx, pack._id);
    if (raced) {
      if (raced.userId !== userId) {
        throw new Error("Passage mode is not available for this pack");
      }
      return toPassageView(raced, args.now, args.tzOffsetMinutes);
    }

    await ctx.db.patch(pack._id, { unifiedReviewEnabled: false });

    const row = await insertPassageMemory(ctx, {
      userId,
      packId: pack._id,
      plan,
      now: args.now,
    });
    await ensurePassageHearts(ctx, userId, row, args.now);

    const customPackVerseRefIds = await loadCustomPackVerseRefIds(ctx, userId);
    const absorbed = absorbedVerseItems(
      members.map((member) => ({
        ...member,
        inCustomPack: customPackVerseRefIds.has(member.verseRefId),
      })),
      row.pieces,
    );
    for (const member of absorbed) {
      await stopMemorizingVerse(ctx, userId, member.verseRefId, args.now);
    }

    return toPassageView(row, args.now, args.tzOffsetMinutes);
  },
});

/**
 * Removes the passage overlay and its progress. Its passage hearts stay as
 * plain range hearts. Pack UX reverts to a verse collection.
 */
export const stop = mutation({
  args: { packId: v.id("packs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await requirePassageForPack(ctx, args.packId, userId);
    await deletePassageAndReviews(ctx, row);
    return null;
  },
});

/**
 * Next unreached piece → learning Read. Throws if the daily introduce budget
 * is exhausted or no unreached piece remains.
 */
export const introduceNext = mutation({
  args: {
    packId: v.id("packs"),
    now: v.number(),
    tzOffsetMinutes: v.number(),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await requirePassageForPack(ctx, args.packId, userId);
    if (row.status !== "building") {
      throw new Error("No unreached pieces left");
    }

    const todayKey = localDayIndex(args.now, args.tzOffsetMinutes);
    const remaining = remainingIntroduces({
      addsOnDay: row.addsOnDay,
      addDayKey: row.addDayKey,
      todayKey,
    });
    if (remaining <= 0) {
      throw new Error("Daily introduce budget is exhausted");
    }

    const currentPieces = withNormalizedPieces(row).pieces;
    const nextIndex = currentPieces.findIndex(
      (piece) => piece.attachment === "unreached",
    );
    const target = currentPieces[nextIndex];
    if (nextIndex < 0 || !target) {
      throw new Error("No unreached pieces left");
    }

    const pieces = currentPieces.map((piece, index) =>
      index === nextIndex
        ? {
            ...piece,
            attachment: "learning" as const,
            learnStage: 0,
            stageReps: 0,
            dueAt: args.now,
          }
        : piece,
    );

    const usedToday = row.addDayKey === todayKey ? row.addsOnDay : 0;
    const patched = await patchPassageMemory(ctx, row._id, {
      pieces,
      addDayKey: todayKey,
      addsOnDay: usedToday + 1,
      lastSessionAt: args.now,
      updatedAt: args.now,
    });
    return toPassageView(patched, args.now, args.tzOffsetMinutes);
  },
});

/**
 * Log a graded attempt. Frontier applies per-piece learning rules; review
 * schedules the passage row on the ≥85% success path; rope/repair log only.
 */
export const recordAttempt = mutation({
  args: {
    packId: v.id("packs"),
    kind: passageAttemptKindValidator,
    quality: qualityValidator,
    accuracy: v.number(),
    now: v.number(),
    tzOffsetMinutes: v.number(),
    timeZone: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    pieceIndex: v.optional(v.number()),
    wordCount: v.optional(v.number()),
    hint: v.optional(v.literal("first-letters")),
    holdSchedule: v.optional(v.boolean()),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = withNormalizedPieces(
      await requirePassageForPack(ctx, args.packId, userId),
    );
    const lastReview = await ctx.db
      .query("passageReviews")
      .withIndex("by_packId", (q) => q.eq("packId", args.packId))
      .order("desc")
      .first();

    await insertPassageReview(ctx, {
      userId,
      packId: row.packId,
      passageMemoryId: row._id,
      kind: args.kind,
      quality: args.quality,
      accuracy: args.accuracy,
      now: args.now,
      durationMs: args.durationMs,
      pieceIndex: args.pieceIndex,
      hint: args.hint,
      holdSchedule: args.holdSchedule,
    });

    let next;

    if (args.holdSchedule) {
      next = await patchPassageMemory(ctx, row._id, {
        startOverUndo: undefined,
        lastSessionAt: args.now,
        updatedAt: args.now,
      });
    } else if (args.kind === "frontier") {
      if (args.pieceIndex === undefined) {
        throw new Error("pieceIndex is required for a frontier attempt");
      }
      const piece = row.pieces[args.pieceIndex];
      if (!piece) {
        throw new Error("Invalid pieceIndex");
      }
      if (piece.attachment === "unreached") {
        throw new Error(
          "Cannot record a frontier attempt on an unreached piece",
        );
      }

      const pieces = progressFrontierPieces(row.pieces, args.pieceIndex, {
        accuracy: args.accuracy,
        now: args.now,
        tzOffsetMinutes: args.tzOffsetMinutes,
        timeZone: args.timeZone,
        wordCount: resolvedPassageWordCount(args.wordCount),
        holdSchedule: args.holdSchedule,
      });

      const allSolid =
        pieces.length > 0 &&
        pieces.every((current) => current.attachment === "solid");
      const graduating = allSolid && row.status === "building";
      const schedule = graduating
        ? freshReviewingSchedule(args.now, args.tzOffsetMinutes, args.timeZone)
        : null;

      next = await patchPassageMemory(ctx, row._id, {
        pieces,
        lastSessionAt: args.now,
        updatedAt: args.now,
        ...(schedule
          ? {
              status: "reviewing" as const,
              ...celebrationPendingPatch(row, "reviewing", args.now),
              ease: schedule.ease,
              intervalDays: schedule.intervalDays,
              dueAt: schedule.dueAt,
              consecutiveCorrect: schedule.consecutiveCorrect,
              lapses: schedule.lapses,
              stageReps: schedule.stageReps,
              earlyReviewApplied: schedule.earlyReviewApplied,
            }
          : {}),
      });
    } else if (args.kind === "review") {
      if (row.status === "reviewing" || row.status === "mastered") {
        const scheduled = applyUnifiedGrade(toPassageSchedule(row), {
          quality: args.quality,
          accuracy: args.accuracy,
          mode: "review",
          now: args.now,
          tzOffsetMinutes: args.tzOffsetMinutes,
          timeZone: args.timeZone,
          hint: args.hint,
          holdSchedule: args.holdSchedule,
          priorHintedCheckIn: isReviewHintedCheckIn(lastReview),
        });
        const nextStatus =
          scheduled.status === "mastered" || scheduled.status === "reviewing"
            ? scheduled.status
            : row.status;
        next = await patchPassageMemory(ctx, row._id, {
          pieces: row.pieces,
          status: nextStatus,
          ease: scheduled.ease,
          intervalDays: scheduled.intervalDays,
          dueAt: scheduled.dueAt,
          consecutiveCorrect: scheduled.consecutiveCorrect,
          lapses: scheduled.lapses,
          stageReps: scheduled.stageReps,
          earlyReviewApplied: scheduled.earlyReviewApplied,
          lastSessionAt: args.now,
          updatedAt: args.now,
          startOverUndo: undefined,
        });
      } else {
        next = await patchPassageMemory(ctx, row._id, {
          pieces: row.pieces,
          lastSessionAt: args.now,
          updatedAt: args.now,
        });
      }
    } else {
      next = await patchPassageMemory(ctx, row._id, {
        pieces: row.pieces,
        lastSessionAt: args.now,
        updatedAt: args.now,
      });
    }

    return toPassageView(next, args.now, args.tzOffsetMinutes);
  },
});

/**
 * Spend a reviewing passage after the learner declines an 80%+ retry. Holds
 * the current interval without logging another recitation.
 */
export const acceptRetryHold = mutation({
  args: {
    packId: v.id("packs"),
    now: v.number(),
    tzOffsetMinutes: v.number(),
    timeZone: v.optional(v.string()),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = withNormalizedPieces(
      await requirePassageForPack(ctx, args.packId, userId),
    );

    if (row.status !== "reviewing" && row.status !== "mastered") {
      return toPassageView(row, args.now, args.tzOffsetMinutes);
    }

    const scheduled = holdReviewingInterval(
      toPassageSchedule(row),
      args.now,
      args.tzOffsetMinutes,
      args.timeZone,
    );
    const nextStatus =
      scheduled.status === "mastered" || scheduled.status === "reviewing"
        ? scheduled.status
        : row.status;
    const next = await patchPassageMemory(ctx, row._id, {
      pieces: row.pieces,
      status: nextStatus,
      ease: scheduled.ease,
      intervalDays: scheduled.intervalDays,
      dueAt: scheduled.dueAt,
      consecutiveCorrect: scheduled.consecutiveCorrect,
      lapses: scheduled.lapses,
      stageReps: scheduled.stageReps,
      earlyReviewApplied: scheduled.earlyReviewApplied,
      lastSessionAt: args.now,
      updatedAt: args.now,
    });

    return toPassageView(next, args.now, args.tzOffsetMinutes);
  },
});

/**
 * The "by heart" moment was shown for this passage. It is owed from the first
 * move out of building until this runs, even across sessions.
 */
export const markCelebrated = mutation({
  args: { packId: v.id("packs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await requirePassageForPack(ctx, args.packId, userId);
    await markPassageCelebrated(ctx, row, Date.now());
    return null;
  },
});

export const dismissMigrationBanner = mutation({
  args: { packId: v.id("packs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await requirePassageForPack(ctx, args.packId, userId);
    await patchPassageMemory(ctx, row._id, {
      migrationBannerDismissed: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Building passage packs with a learning session available today. Only packs
 * that already have a `passageMemory` row appear — an eligible collection
 * without opt-in is not a Learn card. Reviewing/mastered rows belong in
 * `verseMemory.dueQueue`, not here.
 */
export const dueForLearning = query({
  args: { now: v.number(), tzOffsetMinutes: v.number() },
  returns: v.array(dueQueuePackItemValidator),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const projected = await loadPassageDueRecords(ctx, userId, args.now);
    const items: Array<
      NonNullable<ReturnType<typeof toBuildingPassagePackItem>>
    > = [];
    for (const due of projected) {
      if (
        !isProjectedPassageDueForLearning(due, args.now, args.tzOffsetMinutes)
      ) {
        continue;
      }
      const raw = await ctx.db.get(due.passageMemoryId);
      if (!raw || raw.userId !== userId) continue;
      const row = withNormalizedPieces(raw);
      if (!isPassageDueForLearning(row, args.now, args.tzOffsetMinutes)) {
        continue;
      }
      const pack = await ctx.db.get(row.packId);
      if (!pack || pack.userId !== userId) continue;
      const item = toBuildingPassagePackItem(pack, row, args.now);
      if (item) items.push(item);
    }
    return items.sort((a, b) => a.dueAt - b.dueAt);
  },
});

/**
 * Write skinny `passageMemoryDue` rows for this user so dashboard due queries
 * stop collecting fat `pieces` arrays. Idempotent. Memory home calls this
 * instead of doing the work inside Saving / a passage grade.
 */
export const ensureDueBackfill = mutation({
  args: { now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await ensurePassageDueBackfill(ctx, userId, args.now);
    return null;
  },
});

function snapshotPassageUndo(row: Doc<"passageMemory">) {
  return {
    status: row.status,
    pieces: row.pieces,
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    stageReps: row.stageReps,
    earlyReviewApplied: row.earlyReviewApplied,
    lastSessionAt: row.lastSessionAt,
    addsOnDay: row.addsOnDay,
    addDayKey: row.addDayKey,
  };
}

/** Reset chosen pieces to unreached so they re-enter through intake. */
export const startOver = mutation({
  args: {
    packId: v.id("packs"),
    now: v.number(),
    pieceIndexes: v.optional(v.array(v.number())),
    replaceUndo: v.optional(v.boolean()),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = withNormalizedPieces(
      await requirePassageForPack(ctx, args.packId, userId),
    );
    const indexes = new Set(
      args.pieceIndexes ?? row.pieces.map((piece) => piece.index),
    );
    const pieces = startOverPassagePieces(row.pieces, indexes);
    const session = startOverPassageSession(row.pieces, indexes, {
      lastSessionAt: row.lastSessionAt,
      addsOnDay: row.addsOnDay,
      addDayKey: row.addDayKey,
    });
    const next = await patchPassageMemory(ctx, row._id, {
      pieces,
      status: "building",
      startedOverAt: args.now,
      startOverUndo: nextStartOverUndo(
        row.startOverUndo,
        snapshotPassageUndo(row),
        args.replaceUndo,
      ),
      lastSessionAt: session.lastSessionAt,
      addsOnDay: session.addsOnDay,
      addDayKey: session.addDayKey,
      updatedAt: args.now,
    });
    return toPassageView(next, args.now, 0);
  },
});

export const undoStartOver = mutation({
  args: { packId: v.id("packs"), now: v.number(), tzOffsetMinutes: v.number() },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = withNormalizedPieces(
      await requirePassageForPack(ctx, args.packId, userId),
    );
    if (!row.startOverUndo) {
      throw new Error("Nothing to undo");
    }
    const undo = row.startOverUndo;
    const next = await patchPassageMemory(ctx, row._id, {
      status: undo.status,
      pieces: undo.pieces,
      ease: undo.ease,
      intervalDays: undo.intervalDays,
      dueAt: undo.dueAt,
      consecutiveCorrect: undo.consecutiveCorrect,
      lapses: undo.lapses,
      stageReps: undo.stageReps,
      earlyReviewApplied: undo.earlyReviewApplied,
      lastSessionAt: undo.lastSessionAt,
      addsOnDay: undo.addsOnDay ?? 0,
      addDayKey: undo.addDayKey,
      startedOverAt: undefined,
      startOverUndo: undefined,
      updatedAt: args.now,
    });
    return toPassageView(next, args.now, args.tzOffsetMinutes);
  },
});

export const finishRefresh = mutation({
  args: {
    packId: v.id("packs"),
    now: v.number(),
    sittingStartedAt: v.optional(v.number()),
    tzOffsetMinutes: v.number(),
    timeZone: v.optional(v.string()),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = withNormalizedPieces(
      await requirePassageForPack(ctx, args.packId, userId),
    );
    const recent = await ctx.db
      .query("passageReviews")
      .withIndex("by_packId", (q) => q.eq("packId", args.packId))
      .order("desc")
      .take(20);
    if (row.status === "building") {
      const pieces = row.pieces.map((piece) =>
        piece.attachment === "unreached"
          ? piece
          : {
              ...piece,
              learnStage: Math.max(0, piece.learnStage - 1),
              stageReps: 0,
              dueAt: args.now,
            },
      );
      const next = await patchPassageMemory(ctx, row._id, {
        pieces,
        updatedAt: args.now,
      });
      return toPassageView(next, args.now, args.tzOffsetMinutes);
    }
    const nextSchedule = refreshSchedule(toPassageSchedule(row), {
      now: args.now,
      overdueMs: Math.max(0, args.now - row.dueAt),
      recentLapseCount: refreshRecentLapseCount(
        recent,
        args.sittingStartedAt ?? args.now,
      ),
      tzOffsetMinutes: args.tzOffsetMinutes,
      timeZone: args.timeZone,
    });
    const next = await patchPassageMemory(ctx, row._id, {
      status: nextSchedule.status === "mastered" ? "mastered" : "reviewing",
      ease: nextSchedule.ease,
      intervalDays: nextSchedule.intervalDays,
      dueAt: nextSchedule.dueAt,
      consecutiveCorrect: nextSchedule.consecutiveCorrect,
      lapses: nextSchedule.lapses,
      stageReps: nextSchedule.stageReps,
      earlyReviewApplied: nextSchedule.earlyReviewApplied,
      updatedAt: args.now,
    });
    return toPassageView(next, args.now, args.tzOffsetMinutes);
  },
});

export const shakyPieces = query({
  args: { packId: v.id("packs") },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];
    const row = await loadPassageForPack(ctx, args.packId, userId);
    if (!row) return [];
    const reviews = await ctx.db
      .query("passageReviews")
      .withIndex("by_packId", (q) => q.eq("packId", args.packId))
      .order("desc")
      .take(40);
    const byPiece = new Map<
      number,
      Array<{ accuracy: number; lapsed: boolean }>
    >();
    for (const review of reviews) {
      if (review.pieceIndex === undefined) continue;
      const list = byPiece.get(review.pieceIndex) ?? [];
      if (list.length >= 3) continue;
      list.push({
        accuracy: review.accuracy,
        lapsed: recentReviewLapsed(review.accuracy),
      });
      byPiece.set(review.pieceIndex, list);
    }
    return row.pieces
      .filter((piece) => isShakyVerse(byPiece.get(piece.index) ?? []))
      .map((piece) => piece.index);
  },
});

export const reviewFreshness = query({
  args: { packId: v.id("packs"), now: v.number() },
  returns: v.object({ stale: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return { stale: false };
    const row = await loadPassageForPack(ctx, args.packId, userId);
    if (!row) return { stale: false };
    const recent = await ctx.db
      .query("passageReviews")
      .withIndex("by_packId", (q) => q.eq("packId", args.packId))
      .order("desc")
      .take(3);
    const lastReviews = recent.map((review) => ({
      accuracy: review.accuracy,
      lapsed: recentReviewLapsed(review.accuracy),
      createdAt: review.createdAt,
    }));
    const status =
      row.status === "building"
        ? "learning"
        : row.status === "mastered"
          ? "mastered"
          : "reviewing";
    return {
      stale: isStaleVerse({
        status,
        dueAt: row.dueAt,
        intervalDays: row.intervalDays,
        lastReviewedAt: row.lastSessionAt,
        now: args.now,
        startedOverAt: row.startedOverAt,
        lastReviews,
      }),
    };
  },
});

function resolvedPassageWordCount(wordCount: number | undefined): number {
  if (
    wordCount === undefined ||
    !Number.isFinite(wordCount) ||
    wordCount <= 0
  ) {
    return SHORT_VERSE_WORDS;
  }
  return Math.min(500, Math.round(wordCount));
}
