import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  spansLosingCoverage,
  type VerseSpan,
} from "../../src/lib/hearted-verse-coverage";
import { findOrCreateVerseRefId } from "./verseRefs";
import { deletePassageAndReviews } from "./passageMemory";
import {
  findSavedVerse,
  findVerseMemory,
  loadChapterInMemoryItems,
  stopMemorizingVerse,
} from "./verseMemory";

/** Keep the display-only `isHearted` flag in step with the exact heart row. */
async function mirrorIsHearted(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  isHearted: boolean,
): Promise<void> {
  const memory = await findVerseMemory(ctx, userId, verseRefId);
  if (memory && memory.isHearted !== isHearted) {
    await ctx.db.patch(memory._id, { isHearted });
  }
}

/**
 * Insert a heart for this exact span if the user does not already have one.
 * Hearting only saves: it never starts memorizing. Never deletes or patches an
 * existing `savedVerses` row.
 */
export async function heartSpanIfAbsent(
  ctx: MutationCtx,
  userId: Id<"users">,
  span: VerseSpan,
  now: number,
): Promise<"added" | "exists"> {
  const verseRefId = await findOrCreateVerseRefId(ctx, userId, span);
  const existing = await findSavedVerse(ctx, userId, verseRefId);
  if (existing) {
    return "exists";
  }

  await ctx.db.insert("savedVerses", {
    userId,
    verseRefId,
    book: span.book,
    chapter: span.chapter,
    createdAt: now,
  });
  await mirrorIsHearted(ctx, userId, verseRefId, true);
  return "added";
}

/** The rows of a passage heart (one per chapter) when its passage is active. */
async function activePassageHeartRows(
  ctx: MutationCtx,
  userId: Id<"users">,
  saved: Doc<"savedVerses">,
): Promise<{
  passage: Doc<"passageMemory">;
  rows: Doc<"savedVerses">[];
} | null> {
  if (saved.passageMemoryId === undefined) return null;
  const passage = await ctx.db.get(saved.passageMemoryId);
  if (!passage || passage.userId !== userId) return null;

  const rows = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId_passageMemoryId", (q) =>
      q.eq("userId", userId).eq("passageMemoryId", passage._id),
    )
    .collect();
  return { passage, rows };
}

/**
 * Remove-branch of `savedVerses.toggle`. Deletes the heart and clears
 * `isHearted`, then enforces that everything in Memory stays hearted: an
 * active passage heart (all of its chapter rows) is removed together and its
 * passage is stopped, and every in-Memory verse that no remaining heart covers
 * stops memorizing. Review history and `packVerses` rows are kept so
 * memorizing again restores them. No-ops when the verse is not hearted.
 */
export async function unheartByVerseRefId(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<void> {
  const existing = await findSavedVerse(ctx, userId, verseRefId);
  if (!existing) return;

  const passageHeart = await activePassageHeartRows(ctx, userId, existing);
  const removedRows = passageHeart?.rows ?? [existing];
  if (!removedRows.some((row) => row._id === existing._id)) {
    removedRows.push(existing);
  }

  const removed: VerseSpan[] = [];
  for (const row of removedRows) {
    const ref = await ctx.db.get(row.verseRefId);
    if (ref && ref.userId === userId) removed.push(ref);
    await ctx.db.delete(row._id);
    await mirrorIsHearted(ctx, userId, row.verseRefId, false);
  }

  if (passageHeart) {
    await deletePassageAndReviews(ctx, passageHeart.passage);
  }

  const chapters = new Map<string, VerseSpan>();
  for (const span of removed) {
    chapters.set(`${span.book}:${span.chapter}`, span);
  }
  for (const { book, chapter } of chapters.values()) {
    const [remaining, items] = await Promise.all([
      loadChapterHeartSpans(ctx, userId, book, chapter),
      loadChapterInMemoryItems(ctx, userId, book, chapter),
    ]);
    for (const item of spansLosingCoverage(removed, remaining, items)) {
      await stopMemorizingVerse(ctx, userId, item.verseRefId, now);
    }
  }
}

/**
 * Every heart span the user has in one chapter, passage hearts included, for
 * `spanCoveredBy` checks.
 */
export async function loadChapterHeartSpans(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  book: string,
  chapter: number,
): Promise<VerseSpan[]> {
  const rows = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId_book_chapter", (q) =>
      q.eq("userId", userId).eq("book", book).eq("chapter", chapter),
    )
    .collect();
  const refs = await Promise.all(rows.map((row) => ctx.db.get(row.verseRefId)));

  const spans: VerseSpan[] = [];
  for (const ref of refs) {
    if (!ref || ref.userId !== userId) continue;
    spans.push({
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    });
  }
  return spans;
}

/** Join saved rows to their verse refs as `VerseSpan`s for overlap checks. */
export async function loadUserHeartSpans(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<VerseSpan[]> {
  const rows = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .collect();

  const spans: VerseSpan[] = [];
  for (const row of rows) {
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) {
      continue;
    }
    spans.push({
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    });
  }
  return spans;
}
