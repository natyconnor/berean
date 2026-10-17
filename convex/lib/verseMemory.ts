import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { VerseSpan } from "../../src/lib/hearted-verse-coverage";

type MemoryStatus = Doc<"verseMemory">["status"];

/**
 * Look up the single `verseMemory` row for a (user, verse) pair, if any.
 *
 * There is at most one row per pair (enforced by convention via the
 * `by_userId_verseRefId` index and `memorizeSpan`).
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
 * The user's in-Memory `verseMemory` rows, keyed by verse ref.
 *
 * Pack and library joins load this once instead of `findVerseMemory` per row.
 * Rows that were never backfilled (`inMemory` unset) are not in Memory.
 */
export async function loadInMemoryVerseMemoryByRef(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Map<Id<"verseRefs">, Doc<"verseMemory">>> {
  const memories = await ctx.db
    .query("verseMemory")
    .withIndex("by_userId_inMemory", (q) =>
      q.eq("userId", userId).eq("inMemory", true),
    )
    .collect();
  return new Map(memories.map((row) => [row.verseRefId, row]));
}

/** True when the user chose to memorize this verse. */
export function isInMemory(row: Doc<"verseMemory">): boolean {
  return row.inMemory === true;
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

/** The in-Memory row for a verse; throws when the verse is not in Memory. */
export async function requireInMemory(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
): Promise<Doc<"verseMemory">> {
  const memory = await findVerseMemory(ctx, userId, verseRefId);
  if (!memory || !isInMemory(memory)) {
    throw new Error("Start memorizing this verse first.");
  }
  return memory;
}

/** In-Memory verse items in one chapter, as spans for heart coverage checks. */
export async function loadChapterInMemoryItems(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  book: string,
  chapter: number,
): Promise<Array<VerseSpan & { verseRefId: Id<"verseRefs"> }>> {
  const refs = await ctx.db
    .query("verseRefs")
    .withIndex("by_userId_book_chapter", (q) =>
      q.eq("userId", userId).eq("book", book).eq("chapter", chapter),
    )
    .collect();
  const memories = await Promise.all(
    refs.map((ref) => findVerseMemory(ctx, userId, ref._id)),
  );

  const items: Array<VerseSpan & { verseRefId: Id<"verseRefs"> }> = [];
  refs.forEach((ref, index) => {
    const memory = memories[index];
    if (!memory || !isInMemory(memory)) return;
    items.push({
      verseRefId: ref._id,
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    });
  });
  return items;
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
 * Adjust denormalized status counts when an in-Memory verse changes status or
 * enters/leaves Memory. Pass `null` for from/to when adding/removing from
 * totals.
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
 * Take a verse out of Memory. Its schedule, review history, heart, and pack
 * rows are kept, so memorizing it again resumes where it left off. No-op when
 * the verse is not in Memory.
 */
export async function stopMemorizingVerse(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<void> {
  const memory = await findVerseMemory(ctx, userId, verseRefId);
  if (!memory || !isInMemory(memory)) return;

  await ctx.db.patch(memory._id, { inMemory: false });
  await adjustUserMemoryStats(ctx, userId, now, memory.status, null);
}
