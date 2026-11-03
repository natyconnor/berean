import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { adjustUserMemoryStats } from "./verseMemory";
import { noteVerseReviewForActivity } from "./reviewActivityDays";
import {
  startOfZonedDay,
  normalizeTimeZone,
} from "../../src/lib/dashboard-buckets";
import {
  isDueForReview,
  isReviewPhase,
  LEARN_PROGRESS_ACCURACY,
  planVerseAttemptSchedule,
  type MemorySchedule,
} from "../../src/lib/memory-scheduler";
import { HELD_ATTEMPT_BACKSTOP_MS } from "../../src/lib/held-verse-attempt";

export { HELD_ATTEMPT_BACKSTOP_MS };

const LEFTOVER_HELD_CAP = 50;

export function scheduleFromMemory(memory: Doc<"verseMemory">): MemorySchedule {
  return {
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
}

export async function findHeldForVerse(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
): Promise<Doc<"heldVerseAttempts"> | null> {
  return await ctx.db
    .query("heldVerseAttempts")
    .withIndex("by_userId_verseRefId", (q) =>
      q.eq("userId", userId).eq("verseRefId", verseRefId),
    )
    .unique();
}

export async function hasCountedReviewToday(
  ctx: MutationCtx,
  verseMemoryId: Id<"verseMemory">,
  now: number,
  timeZone?: string,
): Promise<boolean> {
  const tz = normalizeTimeZone(timeZone ?? "UTC");
  const dayStart = startOfZonedDay(now, tz);
  const rows = await ctx.db
    .query("verseMemoryReviews")
    .withIndex("by_verseMemoryId_createdAt", (q) =>
      q.eq("verseMemoryId", verseMemoryId).gte("createdAt", dayStart),
    )
    .take(32);
  return rows.some((row) => row.holdSchedule !== true);
}

export async function deleteHeldIfOwned(
  ctx: MutationCtx,
  userId: Id<"users">,
  heldId: Id<"heldVerseAttempts">,
): Promise<Doc<"heldVerseAttempts"> | null> {
  const held = await ctx.db.get(heldId);
  if (!held || held.userId !== userId) return null;
  await ctx.db.delete(held._id);
  return held;
}

export async function replaceHeldForVerse(
  ctx: MutationCtx,
  held: Omit<Doc<"heldVerseAttempts">, "_id" | "_creationTime">,
): Promise<Id<"heldVerseAttempts">> {
  const existing = await findHeldForVerse(ctx, held.userId, held.verseRefId);
  if (existing) await ctx.db.delete(existing._id);
  return await ctx.db.insert("heldVerseAttempts", {
    userId: held.userId,
    verseRefId: held.verseRefId,
    verseMemoryId: held.verseMemoryId,
    quality: held.quality,
    accuracy: held.accuracy,
    answer: held.answer,
    attemptedAt: held.attemptedAt,
    stage: held.stage,
    mode: held.mode,
    ...(held.durationMs !== undefined ? { durationMs: held.durationMs } : {}),
    ...(held.wordCount !== undefined ? { wordCount: held.wordCount } : {}),
    ...(held.tzOffsetMinutes !== undefined
      ? { tzOffsetMinutes: held.tzOffsetMinutes }
      : {}),
    ...(held.timeZone !== undefined ? { timeZone: held.timeZone } : {}),
  });
}

export function canHoldColdMiss(
  memory: Doc<"verseMemory">,
  accuracy: number,
  now: number,
): boolean {
  const current = scheduleFromMemory(memory);
  return (
    isReviewPhase(memory.status) &&
    isDueForReview(current, now) &&
    accuracy < LEARN_PROGRESS_ACCURACY
  );
}

async function commitCountedReview(
  ctx: MutationCtx,
  memory: Doc<"verseMemory">,
  args: {
    quality: Doc<"verseMemoryReviews">["quality"];
    accuracy: number;
    stage: number;
    mode: Doc<"verseMemoryReviews">["mode"];
    durationMs?: number;
    now: number;
    wordCount?: number;
    tzOffsetMinutes?: number;
    timeZone?: string;
    hint?: "first-letters";
    holdSchedule?: boolean;
    refresherUsed?: boolean;
    heldMissAccuracy?: number;
  },
): Promise<MemorySchedule> {
  const current = scheduleFromMemory(memory);
  const holdSchedule = args.holdSchedule === true;
  const refresherUsed = args.refresherUsed === true;

  const existing = await ctx.db
    .query("verseMemoryReviews")
    .withIndex("by_verseMemoryId_createdAt", (q) =>
      q.eq("verseMemoryId", memory._id).eq("createdAt", args.now),
    )
    .first();
  if (existing) {
    return current;
  }

  await ctx.db.insert("verseMemoryReviews", {
    userId: memory.userId,
    verseRefId: memory.verseRefId,
    verseMemoryId: memory._id,
    quality: args.quality,
    accuracy: args.accuracy,
    stage: args.stage,
    mode: args.mode,
    durationMs: args.durationMs,
    createdAt: args.now,
    ...(args.hint ? { hint: args.hint } : {}),
    ...(holdSchedule ? { holdSchedule: true } : {}),
    ...(refresherUsed ? { refresherUsed: true } : {}),
  });

  if (args.timeZone) {
    await noteVerseReviewForActivity(ctx, {
      userId: memory.userId,
      createdAt: args.now,
      accuracy: args.accuracy,
      mode: args.mode,
      stage: args.stage,
      timeZone: args.timeZone,
      ...(holdSchedule ? { holdSchedule: true } : {}),
    });
  }

  const { next, patch } = planVerseAttemptSchedule(current, {
    quality: args.quality,
    accuracy: args.accuracy,
    mode: args.mode,
    now: args.now,
    wordCount: args.wordCount,
    tzOffsetMinutes: args.tzOffsetMinutes,
    timeZone: args.timeZone,
    holdSchedule,
    refresherUsed,
    heldMissAccuracy: args.heldMissAccuracy,
  });

  if (!patch) return next;

  if (memory.status !== next.status) {
    await adjustUserMemoryStats(
      ctx,
      memory.userId,
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
}

export async function applyHeldRow(
  ctx: MutationCtx,
  held: Doc<"heldVerseAttempts">,
): Promise<{ applied: boolean; schedule: MemorySchedule | null }> {
  const memory = await ctx.db.get(held.verseMemoryId);
  if (!memory || memory.userId !== held.userId) {
    await ctx.db.delete(held._id);
    return { applied: false, schedule: null };
  }

  if (
    await hasCountedReviewToday(
      ctx,
      memory._id,
      held.attemptedAt,
      held.timeZone,
    )
  ) {
    await ctx.db.delete(held._id);
    return { applied: false, schedule: scheduleFromMemory(memory) };
  }

  const schedule = await commitCountedReview(ctx, memory, {
    quality: held.quality,
    accuracy: held.accuracy,
    stage: held.stage,
    mode: held.mode,
    durationMs: held.durationMs,
    now: held.attemptedAt,
    wordCount: held.wordCount,
    tzOffsetMinutes: held.tzOffsetMinutes,
    timeZone: held.timeZone,
  });
  const stillHeld = await ctx.db.get(held._id);
  if (stillHeld) await ctx.db.delete(held._id);
  return { applied: true, schedule };
}

export async function applyHeldById(
  ctx: MutationCtx,
  heldId: Id<"heldVerseAttempts">,
  userId?: Id<"users">,
): Promise<{ applied: boolean; schedule: MemorySchedule | null }> {
  const held = await ctx.db.get(heldId);
  if (!held) return { applied: false, schedule: null };
  if (userId && held.userId !== userId) {
    return { applied: false, schedule: null };
  }
  return await applyHeldRow(ctx, held);
}

export async function applyLeftoverHeldForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const rows = await ctx.db
    .query("heldVerseAttempts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(LEFTOVER_HELD_CAP);
  let applied = 0;
  for (const held of rows) {
    const result = await applyHeldRow(ctx, held);
    if (result.applied) applied += 1;
  }
  return applied;
}

export { commitCountedReview };
