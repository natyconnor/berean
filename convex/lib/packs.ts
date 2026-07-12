import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { findVerseMemory } from "./verseMemory";
import {
  verseMatchesScope,
  type VerseScope,
} from "../../src/lib/verse-scope-match";
import { sortByVerseRef } from "../../shared/compare-verse-refs";

/**
 * A pack member: a verse reference joined to its live `verseMemory` schedule.
 * `isDue` is intentionally *not* part of this shape — it depends on `now` and
 * review-phase status (`reviewing` / `mastered`), so callers add it at the
 * query boundary via `isDueForReview` (never `Date.now()` in a query).
 */
export type PackMember = {
  verseRefId: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  status: Doc<"verseMemory">["status"];
  learnStage: number;
  stageReps: number;
  intervalDays: number;
  dueAt: number;
};

/** Get a pack the current user owns, or `null` when missing / not theirs. */
export async function loadOwnedPack(
  ctx: QueryCtx | MutationCtx,
  packId: Id<"packs">,
  userId: Id<"users">,
): Promise<Doc<"packs"> | null> {
  const pack = await ctx.db.get(packId);
  if (!pack || pack.userId !== userId) return null;
  return pack;
}

function toMember(
  ref: Doc<"verseRefs">,
  memory: Doc<"verseMemory">,
): PackMember {
  return {
    verseRefId: ref._id,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
    status: memory.status,
    learnStage: memory.learnStage,
    // Schema-optional (always written now); default legacy rows defensively.
    stageReps: memory.stageReps ?? 0,
    intervalDays: memory.intervalDays,
    dueAt: memory.dueAt,
  };
}

/**
 * All of the user's hearted verses joined to their `verseMemory` schedule.
 *
 * This is the canonical "in Memory" set for scope packs: a verse is in Memory
 * exactly when a `savedVerses` row exists (the same read contract used across
 * `verseMemory.ts`). Rows whose memory seed is missing (legacy, pre-backfill)
 * are skipped rather than fabricated. Bounded by the user's hearted set.
 */
export async function loadHeartedMembers(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<PackMember[]> {
  const saved = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const members: PackMember[] = [];
  for (const row of saved) {
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    const memory = await findVerseMemory(ctx, userId, row.verseRefId);
    if (!memory) continue;
    members.push(toMember(ref, memory));
  }
  return members;
}

/** Hearted members that fall inside a scope, in canonical Bible order. */
export function filterScopeMembers(
  hearted: PackMember[],
  scope: VerseScope,
): PackMember[] {
  return sortByVerseRef(
    hearted.filter((m) =>
      verseMatchesScope({ book: m.book, chapter: m.chapter }, scope),
    ),
  );
}

/**
 * Members of a custom pack, in explicit membership order.
 *
 * Joins each `packVerses` row (read through `by_userId_packId_order`) to its
 * verse reference and `verseMemory` row. Membership is explicit and survives
 * un-hearting (the memory row is durable), so this joins to `verseMemory`
 * directly rather than requiring a live heart. Bounded by pack size.
 */
export async function loadCustomMembers(
  ctx: QueryCtx,
  userId: Id<"users">,
  packId: Id<"packs">,
): Promise<PackMember[]> {
  const rows = await ctx.db
    .query("packVerses")
    .withIndex("by_userId_packId_order", (q) =>
      q.eq("userId", userId).eq("packId", packId),
    )
    .order("asc")
    .collect();

  const members: PackMember[] = [];
  for (const row of rows) {
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    const memory = await findVerseMemory(ctx, userId, row.verseRefId);
    if (!memory) continue;
    members.push(toMember(ref, memory));
  }
  return members;
}

/** The next `order` value to append to a custom pack (0 when empty). */
export async function nextPackOrder(
  ctx: MutationCtx,
  userId: Id<"users">,
  packId: Id<"packs">,
): Promise<number> {
  const last = await ctx.db
    .query("packVerses")
    .withIndex("by_userId_packId_order", (q) =>
      q.eq("userId", userId).eq("packId", packId),
    )
    .order("desc")
    .first();
  return last ? last.order + 1 : 0;
}
