import type { FunctionReference } from "convex/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { HELD_ATTEMPT_BACKSTOP_MS } from "../../src/lib/held-verse-attempt";
import {
  isDueForReview,
  LEARN_PROGRESS_ACCURACY,
  planVerseAttemptSchedule,
} from "../../src/lib/memory-scheduler";
import { piecesAfterUnhintedTry } from "../../src/lib/passage-shaky";
import {
  insertPassageReview,
  patchPassageMemory,
  toPassageSchedule,
  withNormalizedPieces,
} from "./passageMemory";

/**
 * A due Memorized passage's held first-try miss, like S5's
 * `heldVerseAttempts`: nothing counts until Continue, leaving, the next load,
 * or the backstop applies it, or a finished From memory try replaces it.
 */

const LEFTOVER_HELD_CAP = 50;

export type PassageReviewInput = {
  quality: Doc<"passageReviews">["quality"];
  accuracy: number;
  now: number;
  tzOffsetMinutes: number;
  timeZone?: string;
  durationMs?: number;
  pieceAccuracies?: (number | null)[];
  refresherUsed?: boolean;
  heldMissAccuracy?: number;
};

/**
 * Count one whole-passage review try. A Memorized passage moves its one
 * schedule by the overall score and updates shaky verses. A repeat at the
 * same `now` is a retried save and changes nothing.
 */
export async function commitPassageReview(
  ctx: MutationCtx,
  row: Doc<"passageMemory">,
  args: PassageReviewInput,
): Promise<Doc<"passageMemory">> {
  const retried = await ctx.db
    .query("passageReviews")
    .withIndex("by_userId_createdAt", (q) =>
      q.eq("userId", row.userId).eq("createdAt", args.now),
    )
    .first();
  if (
    retried &&
    retried.passageMemoryId === row._id &&
    retried.kind === "review"
  ) {
    return row;
  }

  await insertPassageReview(ctx, {
    userId: row.userId,
    packId: row.packId,
    passageMemoryId: row._id,
    kind: "review",
    quality: args.quality,
    accuracy: args.accuracy,
    now: args.now,
    durationMs: args.durationMs,
  });

  if (row.status !== "reviewing" && row.status !== "mastered") {
    return await patchPassageMemory(ctx, row._id, {
      pieces: row.pieces,
      lastSessionAt: args.now,
      updatedAt: args.now,
    });
  }

  const schedule = toPassageSchedule(row);
  const { next: scheduled } = planVerseAttemptSchedule(schedule, {
    quality: args.quality,
    accuracy: args.accuracy,
    mode: "review",
    now: args.now,
    tzOffsetMinutes: args.tzOffsetMinutes,
    timeZone: args.timeZone,
    item: "passage",
    refresherUsed: args.refresherUsed,
    heldMissAccuracy: args.heldMissAccuracy,
  });
  return await patchPassageMemory(ctx, row._id, {
    pieces: args.pieceAccuracies
      ? piecesAfterUnhintedTry(
          row.pieces,
          args.pieceAccuracies,
          isDueForReview(schedule, args.now),
        )
      : row.pieces,
    status: scheduled.status === "mastered" ? "mastered" : "reviewing",
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
}

function canHoldPassageMiss(
  row: Doc<"passageMemory">,
  accuracy: number,
  now: number,
): boolean {
  return (
    (row.status === "reviewing" || row.status === "mastered") &&
    row.dueAt <= now &&
    accuracy < LEARN_PROGRESS_ACCURACY
  );
}

type HeldBackstop = FunctionReference<
  "mutation",
  "internal",
  { heldId: Id<"heldPassageAttempts"> },
  null
>;

/**
 * Store a due passage's first unhinted miss without counting it, replacing
 * any earlier hold, and schedule the one-shot backstop.
 */
export async function holdPassageMiss(
  ctx: MutationCtx,
  row: Doc<"passageMemory">,
  held: Omit<
    Doc<"heldPassageAttempts">,
    "_id" | "_creationTime" | "userId" | "packId" | "passageMemoryId"
  >,
  backstop: HeldBackstop,
): Promise<Id<"heldPassageAttempts">> {
  if (!canHoldPassageMiss(row, held.accuracy, held.attemptedAt)) {
    throw new Error("This try cannot be held.");
  }
  await deleteHeldForPassage(ctx, row._id);
  const heldId = await ctx.db.insert("heldPassageAttempts", {
    ...held,
    userId: row.userId,
    packId: row.packId,
    passageMemoryId: row._id,
  });
  await ctx.scheduler.runAfter(HELD_ATTEMPT_BACKSTOP_MS, backstop, { heldId });
  return heldId;
}

export async function deleteHeldForPassage(
  ctx: MutationCtx,
  passageMemoryId: Id<"passageMemory">,
): Promise<void> {
  const rows = await ctx.db
    .query("heldPassageAttempts")
    .withIndex("by_passageMemoryId", (q) =>
      q.eq("passageMemoryId", passageMemoryId),
    )
    .take(8);
  for (const row of rows) await ctx.db.delete(row._id);
}

export async function deleteHeldPassageIfOwned(
  ctx: MutationCtx,
  userId: Id<"users">,
  heldId: Id<"heldPassageAttempts">,
): Promise<Doc<"heldPassageAttempts"> | null> {
  const held = await ctx.db.get(heldId);
  if (!held || held.userId !== userId) return null;
  await ctx.db.delete(held._id);
  return held;
}

/**
 * Count the held miss as if Continue was pressed, dated to its try. A
 * passage that is gone, reset, or no longer due at that time drops it.
 */
export async function applyHeldPassageRow(
  ctx: MutationCtx,
  held: Doc<"heldPassageAttempts">,
): Promise<Doc<"passageMemory"> | null> {
  await ctx.db.delete(held._id);
  const raw = await ctx.db.get(held.passageMemoryId);
  if (!raw || raw.userId !== held.userId) return null;
  const row = withNormalizedPieces(raw);
  if (!canHoldPassageMiss(row, held.accuracy, held.attemptedAt)) return row;
  return await commitPassageReview(ctx, row, {
    quality: held.quality,
    accuracy: held.accuracy,
    now: held.attemptedAt,
    tzOffsetMinutes: held.tzOffsetMinutes,
    timeZone: held.timeZone,
    durationMs: held.durationMs,
    pieceAccuracies: held.pieceAccuracies,
  });
}

/** Missing ids, and ids another user owns, are a no-op. */
export async function applyHeldPassageById(
  ctx: MutationCtx,
  heldId: Id<"heldPassageAttempts">,
  userId?: Id<"users">,
): Promise<Doc<"passageMemory"> | null> {
  const held = await ctx.db.get(heldId);
  if (!held || (userId && held.userId !== userId)) return null;
  return await applyHeldPassageRow(ctx, held);
}

export async function applyLeftoverHeldPassagesForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const rows = await ctx.db
    .query("heldPassageAttempts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(LEFTOVER_HELD_CAP);
  for (const held of rows) await applyHeldPassageRow(ctx, held);
}
