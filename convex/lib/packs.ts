import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { loadInMemoryVerseMemoryByRef } from "./verseMemory";
import { loadPassagePackIds } from "./passageDue";
import {
  verseMatchesScope,
  type VerseScope,
} from "../../src/lib/verse-scope-match";
import { sortByVerseRef } from "../../shared/compare-verse-refs";
import { isDueForReview, isReviewPhase } from "../../src/lib/memory-scheduler";

/** Every `passageMemory` row for this user (`by_userId`, never `.filter`). */
export async function loadPassageMemoryByUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"passageMemory">[]> {
  return await ctx.db
    .query("passageMemory")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export function passageMemoryByPackId(
  rows: readonly Doc<"passageMemory">[],
): Map<Id<"packs">, Doc<"passageMemory">> {
  return new Map(rows.map((row) => [row.packId, row]));
}

/** Frozen piece spans for a passage pack card (composite recitation members). */
export function passagePiecesAsMembers(
  pieces: Doc<"passageMemory">["pieces"],
): Array<{
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}> {
  return pieces.map((piece) => ({
    book: piece.book,
    chapter: piece.chapter,
    startVerse: piece.startVerse,
    endVerse: piece.endVerse,
  }));
}

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

async function memberForVerseRef(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  memoryByRef: Map<Id<"verseRefs">, Doc<"verseMemory">>,
): Promise<PackMember | null> {
  const memory = memoryByRef.get(verseRefId);
  if (!memory) return null;
  const ref = await ctx.db.get(verseRefId);
  if (!ref || ref.userId !== userId) return null;
  return toMember(ref, memory);
}

/**
 * Every verse the user has in Memory, joined to its schedule.
 *
 * This is the member set scope packs filter by scope. In-Memory rows are
 * collected once; verse refs are `db.get` in parallel so a 100-verse pack is
 * one index scan plus N point reads.
 */
export async function loadInMemoryMembers(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<PackMember[]> {
  const memoryByRef = await loadInMemoryVerseMemoryByRef(ctx, userId);
  const loaded = await Promise.all(
    [...memoryByRef.keys()].map((verseRefId) =>
      memberForVerseRef(ctx, userId, verseRefId, memoryByRef),
    ),
  );
  return loaded.filter((member): member is PackMember => member !== null);
}

/**
 * A pack's current members: scope packs resolve live from the in-Memory set,
 * custom packs from their explicit membership rows.
 */
export async function loadPackMembers(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  pack: Doc<"packs">,
): Promise<PackMember[]> {
  if (pack.kind === "scope" && pack.scope) {
    const inMemory = await loadInMemoryMembers(ctx, userId);
    return filterScopeMembers(inMemory, pack.scope);
  }
  return await loadCustomMembers(ctx, userId, pack._id);
}

/** In-Memory members that fall inside a scope, in canonical Bible order. */
export function filterScopeMembers(
  inMemory: PackMember[],
  scope: VerseScope,
): PackMember[] {
  return sortByVerseRef(
    inMemory.filter((m) =>
      verseMatchesScope({ book: m.book, chapter: m.chapter }, scope),
    ),
  );
}

/**
 * Members of a custom pack, in explicit membership order.
 *
 * Joins each `packVerses` row to its verse reference and `verseMemory` row.
 * Membership is `packVerses` rows whose verse is in Memory. Rows survive
 * stopping and unhearting, so memorizing the verse again restores it.
 */
export async function loadCustomMembers(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  packId: Id<"packs">,
): Promise<PackMember[]> {
  const [rows, memoryByRef] = await Promise.all([
    ctx.db
      .query("packVerses")
      .withIndex("by_userId_packId_order", (q) =>
        q.eq("userId", userId).eq("packId", packId),
      )
      .order("asc")
      .collect(),
    loadInMemoryVerseMemoryByRef(ctx, userId),
  ]);

  const loaded = await Promise.all(
    rows.map((row) =>
      memberForVerseRef(ctx, userId, row.verseRefId, memoryByRef),
    ),
  );
  return loaded.filter((member): member is PackMember => member !== null);
}

/** Verse refs listed in any of the user's custom packs. */
export async function loadCustomPackVerseRefIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Set<Id<"verseRefs">>> {
  const index = await loadPackMembershipIndex(ctx, userId);
  return new Set(index.customByVerseRef.keys());
}

/**
 * Which packs list each verse, for `InMemoryVerseItem.packIds`: custom packs
 * by their `packVerses` rows, and scope packs not in passage mode by scope.
 * Membership of an in-Memory verse is exactly these packs. Pass
 * `onlyVerseRefId` to read just that verse's `packVerses` rows.
 */
export async function loadPackMembershipIndex(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  onlyVerseRefId?: Id<"verseRefs">,
): Promise<{
  customByVerseRef: Map<Id<"verseRefs">, Id<"packs">[]>;
  packIdsFor: (
    verseRefId: Id<"verseRefs">,
    span: { book: string; chapter: number },
  ) => Id<"packs">[];
}> {
  const [packs, packVerses, passagePackIds] = await Promise.all([
    ctx.db
      .query("packs")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("packVerses")
      .withIndex("by_userId_verseRefId", (q) =>
        onlyVerseRefId === undefined
          ? q.eq("userId", userId)
          : q.eq("userId", userId).eq("verseRefId", onlyVerseRefId),
      )
      .collect(),
    loadPassagePackIds(ctx, userId),
  ]);

  const customPackIds = new Set(
    packs.filter((pack) => pack.kind === "custom").map((pack) => pack._id),
  );
  const customByVerseRef = new Map<Id<"verseRefs">, Id<"packs">[]>();
  for (const row of packVerses) {
    if (!customPackIds.has(row.packId)) continue;
    const ids = customByVerseRef.get(row.verseRefId) ?? [];
    if (!ids.includes(row.packId)) ids.push(row.packId);
    customByVerseRef.set(row.verseRefId, ids);
  }

  const scopePacks = packs.filter(
    (pack) =>
      pack.kind === "scope" &&
      pack.scope !== undefined &&
      !passagePackIds.has(pack._id),
  );

  return {
    customByVerseRef,
    packIdsFor: (verseRefId, span) => [
      ...(customByVerseRef.get(verseRefId) ?? []),
      ...scopePacks
        .filter((pack) => pack.scope && verseMatchesScope(span, pack.scope))
        .map((pack) => pack._id),
    ],
  };
}

/**
 * Scope packs with unified recitation on, joined to their live members.
 * Used to hide those verses from the global due queue and count each pack
 * as a single due item. Packs that already have a `passageMemory` row are
 * excluded: leftover hearts stay in the verse due scan, and review goes
 * through `passageMemory` (the unified flag is cleared on start).
 */
export async function loadUnifiedReviewPacks(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  passagePackIds?: ReadonlySet<Id<"packs">>,
): Promise<Array<{ pack: Doc<"packs">; members: PackMember[] }>> {
  const packs = await ctx.db
    .query("packs")
    .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
    .collect();

  const flagged = packs.filter((pack) => pack.unifiedReviewEnabled);
  if (flagged.length === 0) return [];

  const passageIds = passagePackIds ?? (await loadPassagePackIds(ctx, userId));
  const unifiedPacks = flagged.filter((pack) => !passageIds.has(pack._id));
  if (unifiedPacks.length === 0) return [];

  // Scope packs all share the same in-Memory set — load it once instead of
  // collecting it again per pack on dueCount / dueQueue.
  const needsInMemory = unifiedPacks.some(
    (pack) => pack.kind === "scope" && pack.scope,
  );
  const inMemory = needsInMemory
    ? await loadInMemoryMembers(ctx, userId)
    : null;

  const unified: Array<{ pack: Doc<"packs">; members: PackMember[] }> = [];
  for (const pack of unifiedPacks) {
    const members =
      pack.kind === "scope" && pack.scope && inMemory
        ? filterScopeMembers(inMemory, pack.scope)
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
  ctx: QueryCtx | MutationCtx,
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
