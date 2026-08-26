import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { findVerseMemory, isLiveHeartedMemory } from "./verseMemory";
import {
  verseMatchesScope,
  type VerseScope,
} from "../../src/lib/verse-scope-match";
import { sortByVerseRef } from "../../shared/compare-verse-refs";
import { isDueForReview, isReviewPhase } from "../../src/lib/memory-scheduler";

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
  ease: number;
  intervalDays: number;
  consecutiveCorrect: number;
  lapses: number;
  earlyReviewApplied?: boolean;
  dueAt: number;
  lastReviewedAt?: number;
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
    ease: memory.ease,
    intervalDays: memory.intervalDays,
    consecutiveCorrect: memory.consecutiveCorrect,
    lapses: memory.lapses,
    earlyReviewApplied: memory.earlyReviewApplied,
    dueAt: memory.dueAt,
    lastReviewedAt: memory.lastReviewedAt,
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

/**
 * A pack's current members: scope packs resolve live from hearted verses,
 * custom packs from their explicit membership rows.
 */
export async function loadPackMembers(
  ctx: QueryCtx,
  userId: Id<"users">,
  pack: Doc<"packs">,
): Promise<PackMember[]> {
  if (pack.kind === "scope" && pack.scope) {
    const hearted = await loadHeartedMembers(ctx, userId);
    return filterScopeMembers(hearted, pack.scope);
  }
  return await loadCustomMembers(ctx, userId, pack._id);
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
 * Joins each `packVerses` row to its verse reference and `verseMemory` row.
 * Membership is hearted-only: unhearting deletes `packVerses` rows, and this
 * loader also skips any stale membership whose verse is no longer hearted.
 * Bounded by pack size.
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
    const saved = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_verseRefId", (q) =>
        q.eq("userId", userId).eq("verseRefId", row.verseRefId),
      )
      .unique();
    if (!saved) continue;
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    const memory = await findVerseMemory(ctx, userId, row.verseRefId);
    if (!memory || !isLiveHeartedMemory(memory)) continue;
    members.push(toMember(ref, memory));
  }
  return members;
}

/**
 * Scope packs with unified recitation on, joined to their live members.
 * Used to hide those verses from the global due queue and count each pack
 * as a single due item.
 */
export async function loadUnifiedReviewPacks(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Array<{ pack: Doc<"packs">; members: PackMember[] }>> {
  const packs = await ctx.db
    .query("packs")
    .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
    .collect();

  const unifiedPacks = packs.filter((pack) => pack.unifiedReviewEnabled);
  if (unifiedPacks.length === 0) return [];

  // Scope packs all share the same hearted set — load it once instead of
  // collecting every heart again per pack on dueCount / dueQueue.
  const needsHearted = unifiedPacks.some(
    (pack) => pack.kind === "scope" && pack.scope,
  );
  const hearted = needsHearted ? await loadHeartedMembers(ctx, userId) : null;

  const unified: Array<{ pack: Doc<"packs">; members: PackMember[] }> = [];
  for (const pack of unifiedPacks) {
    const members =
      pack.kind === "scope" && pack.scope && hearted
        ? filterScopeMembers(hearted, pack.scope)
        : await loadCustomMembers(ctx, userId, pack._id);
    unified.push({ pack, members });
  }
  return unified;
}

/** Review-phase members of unified packs (hidden from the global review due). */
export function unifiedReviewPhaseVerseRefIds(
  packs: readonly { members: readonly PackMember[] }[],
): Set<string> {
  const ids = new Set<string>();
  for (const { members } of packs) {
    for (const member of members) {
      if (isReviewPhase(member.status)) ids.add(member.verseRefId);
    }
  }
  return ids;
}

/**
 * Review-phase verse ref ids in the user's unified-review packs.
 * Learning / new members stay visible to learningDue even while the flag is on
 * (a unified recitation can lapse everyone back into learning).
 */
export async function loadUnifiedReviewVerseRefIds(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Set<string>> {
  return unifiedReviewPhaseVerseRefIds(
    await loadUnifiedReviewPacks(ctx, userId),
  );
}

function everyMemberInReview(members: readonly PackMember[]): boolean {
  return (
    members.length > 0 &&
    members.every((member) => isReviewPhase(member.status))
  );
}

/**
 * How many unified packs are due as a single item. Only packs whose members
 * are all in review phase can be recited; mixed packs (a lapse still learning)
 * stay out of the due queue until Learn finishes. If schedules drift, any due
 * member counts the pack as 1.
 */
export function dueUnifiedPackDueAt(
  members: readonly PackMember[],
  now: number,
): number | null {
  if (!everyMemberInReview(members)) return null;
  let min: number | null = null;
  for (const member of members) {
    if (!isDueForReview(member, now)) continue;
    if (min === null || member.dueAt < min) min = member.dueAt;
  }
  return min;
}

/** Shared dueAt for forecast: soonest member, even if not due yet. */
export function unifiedPackForecastDueAt(
  members: readonly PackMember[],
): number | null {
  if (!everyMemberInReview(members)) return null;
  let min: number | null = null;
  for (const member of members) {
    if (min === null || member.dueAt < min) min = member.dueAt;
  }
  return min;
}

export function countDueUnifiedReviewPacks(
  packs: readonly { members: readonly PackMember[] }[],
  now: number,
): number {
  let due = 0;
  for (const { members } of packs) {
    if (dueUnifiedPackDueAt(members, now) !== null) due += 1;
  }
  return due;
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
