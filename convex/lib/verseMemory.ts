import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { initialSchedule } from "../../src/lib/memory-scheduler";

type MemoryStatus = Doc<"verseMemory">["status"];

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

export function isLiveHeartedMemory(row: Doc<"verseMemory">): boolean {
  return row.isHearted === true;
}

/** Canonical heart check: a `savedVerses` row must exist. */
export async function findSavedVerse(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
): Promise<Doc<"savedVerses"> | null> {
  return await ctx.db
    .query("savedVerses")
    .withIndex("by_userId_verseRefId", (q) =>
      q.eq("userId", userId).eq("verseRefId", verseRefId),
    )
    .unique();
}

/**
 * Require the verse to be hearted before memory create/attempt paths.
 * Memory is hearted-only: no `savedVerses` row → reject.
 */
export async function requireHeartedSavedVerse(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
): Promise<Doc<"savedVerses">> {
  const saved = await findSavedVerse(ctx, userId, verseRefId);
  if (!saved) {
    throw new Error("Verse must be hearted before it can be practiced");
  }
  return saved;
}

/** Remove the verse from every custom pack the user owns. */
export async function deletePackMembershipsForVerse(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
): Promise<number> {
  const rows = await ctx.db
    .query("packVerses")
    .withIndex("by_userId_verseRefId", (q) =>
      q.eq("userId", userId).eq("verseRefId", verseRefId),
    )
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

const EMPTY_STATS = {
  new: 0,
  learning: 0,
  reviewing: 0,
  mastered: 0,
  total: 0,
} as const;

async function getOrCreateUserMemoryStats(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<Doc<"userMemoryStats">> {
  const existing = await ctx.db
    .query("userMemoryStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("userMemoryStats", {
    userId,
    ...EMPTY_STATS,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to create user memory stats");
  return created;
}

/**
 * Adjust denormalized status counts when a hearted verse enters/leaves a status
 * or the hearted set. Pass `null` for from/to when adding/removing from totals.
 */
export async function adjustUserMemoryStats(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  from: MemoryStatus | null,
  to: MemoryStatus | null,
): Promise<void> {
  if (from === to) return;

  const stats = await getOrCreateUserMemoryStats(ctx, userId, now);
  const next = {
    new: stats.new,
    learning: stats.learning,
    reviewing: stats.reviewing,
    mastered: stats.mastered,
    total: stats.total,
  };

  if (from !== null) {
    next[from] = Math.max(0, next[from] - 1);
    next.total = Math.max(0, next.total - 1);
  }
  if (to !== null) {
    next[to] += 1;
    next.total += 1;
  }

  await ctx.db.patch(stats._id, { ...next, updatedAt: now });
}

/**
 * Idempotently create the `verseMemory` row for a hearted (user, verse) pair.
 *
 * Callers must already have verified a `savedVerses` row exists (or be the
 * heart write path that just inserted one). Returns the existing row's id when
 * one is already present.
 */
export async function seedVerseMemory(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<Id<"verseMemory">> {
  const existing = await findVerseMemory(ctx, userId, verseRefId);
  if (existing) {
    if (!isLiveHeartedMemory(existing)) {
      await ctx.db.patch(existing._id, { isHearted: true });
      await adjustUserMemoryStats(ctx, userId, now, null, existing.status);
    }
    return existing._id;
  }

  const schedule = initialSchedule(now);
  const id = await ctx.db.insert("verseMemory", {
    userId,
    verseRefId,
    status: schedule.status,
    learnStage: schedule.learnStage,
    stageReps: schedule.stageReps,
    ease: schedule.ease,
    intervalDays: schedule.intervalDays,
    dueAt: schedule.dueAt,
    consecutiveCorrect: schedule.consecutiveCorrect,
    lapses: schedule.lapses,
    earlyReviewApplied: schedule.earlyReviewApplied,
    isHearted: true,
    createdAt: now,
  });
  await adjustUserMemoryStats(ctx, userId, now, null, schedule.status);
  return id;
}

/**
 * Idempotent get-or-create that returns the full row (not just the id).
 * Requires the verse to already be hearted.
 */
export async function getOrCreateVerseMemory(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<Doc<"verseMemory">> {
  await requireHeartedSavedVerse(ctx, userId, verseRefId);

  const existing = await findVerseMemory(ctx, userId, verseRefId);
  if (existing) {
    if (!isLiveHeartedMemory(existing)) {
      await ctx.db.patch(existing._id, { isHearted: true });
      await adjustUserMemoryStats(ctx, userId, now, null, existing.status);
      const refreshed = await ctx.db.get(existing._id);
      if (!refreshed) throw new Error("Failed to refresh verse memory row");
      return refreshed;
    }
    return existing;
  }

  const id = await seedVerseMemory(ctx, userId, verseRefId, now);
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to create verse memory row");
  }
  return created;
}
