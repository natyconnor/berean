import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  deletePassageAndReviews,
  findPassageByPackId,
  insertPassageMemory,
  insertPassageReview,
  loadPassageForPack,
  memberToHeart,
  memberToSchedule,
  patchPassageMemory,
  requireOwnedPack,
  requirePassageForPack,
  toPassageSchedule,
  toPassageView,
} from "./lib/passageMemory";
import {
  passageAttemptKindValidator,
  passageViewValidator,
  pieceBaseValidator,
  qualityValidator,
} from "./lib/passageValues";
import { loadPackMembers } from "./lib/packs";
import { unheartByVerseRefId } from "./lib/savedVerses";
import { findVerseRefId } from "./lib/verseRefs";
import { SHORT_VERSE_WORDS } from "../src/lib/memory-scheduler";
import { packAllowsPassageMode } from "../src/lib/passage-eligibility";
import {
  isPassagePieceLocked,
  localDayIndex,
  PASSAGE_PASS_ACCURACY,
  progressPassagePiece,
  remainingIntroduces,
} from "../src/lib/passage-frontier";
import {
  assertFrozenPieceBases,
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
    packId: v.id("packs"),
    now: v.number(),
    tzOffsetMinutes: v.number(),
  },
  returns: v.union(passageViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const row = await loadPassageForPack(ctx, args.packId, userId);
    if (!row) return null;

    return toPassageView(row, args.now, args.tzOffsetMinutes);
  },
});

/**
 * Explicit opt-in. Idempotent if a passage row already exists. Otherwise
 * freezes client-supplied pieces, maybe unhearts auto-hearts, and clears
 * unified recitation. Does not run on pack open alone.
 */
export const start = mutation({
  args: {
    packId: v.id("packs"),
    pieces: v.array(pieceBaseValidator),
    now: v.number(),
    tzOffsetMinutes: v.number(),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await requireOwnedPack(ctx, args.packId, userId);

    const existing = await findPassageByPackId(ctx, pack._id);
    if (existing && existing.userId === userId) {
      return toPassageView(existing, args.now, args.tzOffsetMinutes);
    }

    if (pack.kind !== "scope" || !pack.scope) {
      throw new Error(
        "Passage mode is only available for eligible scope packs",
      );
    }
    if (!packAllowsPassageMode(pack.scope)) {
      throw new Error(
        "Passage mode is only available for eligible scope packs",
      );
    }

    assertFrozenPieceBases(args.pieces);

    const members = await loadPackMembers(ctx, userId, pack);
    const plan = planStart({
      pieces: args.pieces,
      hearts: members.map(memberToHeart),
      scope: pack.scope,
      unifiedEnabled: pack.unifiedReviewEnabled === true,
      memberSchedules: members.map(memberToSchedule),
      now: args.now,
    });

    for (const span of plan.unheartSpans) {
      const verseRefId = await findVerseRefId(ctx, userId, span);
      if (!verseRefId) continue;
      await unheartByVerseRefId(ctx, userId, verseRefId, args.now);
    }

    await ctx.db.patch(pack._id, { unifiedReviewEnabled: false });

    const row = await insertPassageMemory(ctx, {
      userId,
      packId: pack._id,
      plan,
      now: args.now,
    });
    return toPassageView(row, args.now, args.tzOffsetMinutes);
  },
});

/**
 * Removes the passage overlay. Hearts are left untouched. Pack UX reverts to
 * a heart collection.
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

    const todayKey = localDayIndex(args.now, args.tzOffsetMinutes);
    const remaining = remainingIntroduces({
      addsOnDay: row.addsOnDay,
      addDayKey: row.addDayKey,
      todayKey,
    });
    if (remaining <= 0) {
      throw new Error("Daily introduce budget is exhausted");
    }

    const nextIndex = row.pieces.findIndex(
      (piece) => piece.attachment === "unreached",
    );
    const target = row.pieces[nextIndex];
    if (nextIndex < 0 || !target) {
      throw new Error("No unreached pieces left");
    }

    const pieces = row.pieces.map((piece, index) =>
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
    durationMs: v.optional(v.number()),
    pieceIndex: v.optional(v.number()),
  },
  returns: passageViewValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await requirePassageForPack(ctx, args.packId, userId);

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
    });

    let next;

    if (args.kind === "frontier") {
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

      let pieces = row.pieces;
      if (!isPassagePieceLocked(piece, args.now)) {
        const progressed = progressPassagePiece(piece, {
          accuracy: args.accuracy,
          now: args.now,
          tzOffsetMinutes: args.tzOffsetMinutes,
          wordCount: SHORT_VERSE_WORDS,
        });
        pieces = row.pieces.map((current, index) =>
          index === args.pieceIndex ? progressed : current,
        );
      }

      const allSolid =
        pieces.length > 0 &&
        pieces.every((current) => current.attachment === "solid");
      const graduating = allSolid && row.status === "building";
      const schedule = graduating
        ? freshReviewingSchedule(args.now, args.tzOffsetMinutes)
        : null;

      next = await patchPassageMemory(ctx, row._id, {
        pieces,
        lastSessionAt: args.now,
        updatedAt: args.now,
        ...(schedule
          ? {
              status: "reviewing" as const,
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
      if (
        (row.status === "reviewing" || row.status === "mastered") &&
        args.accuracy >= PASSAGE_PASS_ACCURACY
      ) {
        const scheduled = applyUnifiedGrade(toPassageSchedule(row), {
          quality: args.quality,
          accuracy: args.accuracy,
          mode: "review",
          now: args.now,
          tzOffsetMinutes: args.tzOffsetMinutes,
        });
        const nextStatus =
          scheduled.status === "mastered" || scheduled.status === "reviewing"
            ? scheduled.status
            : row.status;
        next = await patchPassageMemory(ctx, row._id, {
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
      } else {
        next = await patchPassageMemory(ctx, row._id, {
          lastSessionAt: args.now,
          updatedAt: args.now,
        });
      }
    } else {
      next = await patchPassageMemory(ctx, row._id, {
        lastSessionAt: args.now,
        updatedAt: args.now,
      });
    }

    return toPassageView(next, args.now, args.tzOffsetMinutes);
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
