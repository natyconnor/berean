import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  initialSchedule,
  MASTERED_INTERVAL_DAYS,
  type MemoryStatus,
} from "../../src/lib/memory-scheduler";

/**
 * Look up the single `verseMemory` row for a (user, verse) pair, if any.
 *
 * There is at most one row per pair (enforced by convention via the
 * `by_userId_verseRefId` index + the seed helper below).
 */
export async function findVerseMemory(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
): Promise<Doc<"verseMemory"> | null> {
  return await ctx.db
    .query("verseMemory")
    .withIndex("by_userId_verseRefId", (q) =>
      q.eq("userId", userId).eq("verseRefId", verseRefId),
    )
    .unique();
}

/**
 * Idempotently create the `verseMemory` row for a (user, verse) pair.
 *
 * Returns the existing row's id when one is already present, so callers (heart
 * write path, backfill, `getOrCreateForVerse`) never create duplicates.
 */
export async function seedVerseMemory(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<Id<"verseMemory">> {
  const existing = await findVerseMemory(ctx, userId, verseRefId);
  if (existing) {
    return existing._id;
  }

  const schedule = initialSchedule(now);
  return await ctx.db.insert("verseMemory", {
    userId,
    verseRefId,
    status: schedule.status,
    learnStage: schedule.learnStage,
    ease: schedule.ease,
    intervalDays: schedule.intervalDays,
    dueAt: schedule.dueAt,
    consecutiveCorrect: schedule.consecutiveCorrect,
    lapses: schedule.lapses,
    createdAt: now,
  });
}

/**
 * Idempotent get-or-create that returns the full row (not just the id).
 */
export async function getOrCreateVerseMemory(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<Doc<"verseMemory">> {
  const existing = await findVerseMemory(ctx, userId, verseRefId);
  if (existing) {
    return existing;
  }

  const id = await seedVerseMemory(ctx, userId, verseRefId, now);
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to create verse memory row");
  }
  return created;
}

/**
 * Derive the active (non-suspended) status implied by a row's schedule.
 *
 * Fallback for un-suspending legacy rows that predate the `previousStatus`
 * field (see `setSuspended`, which now restores the persisted status directly).
 * Note this cannot distinguish `new` from `learning` when both `intervalDays`
 * and `learnStage` are 0 — it returns `new` — which is exactly why
 * `previousStatus` is persisted for rows suspended going forward.
 */
export function deriveActiveStatus(row: {
  intervalDays: number;
  learnStage: number;
}): Exclude<MemoryStatus, "suspended"> {
  if (row.intervalDays >= MASTERED_INTERVAL_DAYS) return "mastered";
  if (row.intervalDays > 0) return "reviewing";
  if (row.learnStage > 0) return "learning";
  return "new";
}
