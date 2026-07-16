/**
 * Pure verse-vs-scope matching, extracted from `studySessions.resolveScope`'s
 * book / chapter-range logic so it has a single, unit-tested source of truth
 * shared by study sessions and packs.
 *
 * A scope's `tags` / `tagMatchMode` intentionally live outside this helper:
 * they filter NOTES, not verses, so verse membership depends only on `books`
 * and optional per-book `chapterRanges`.
 */
export interface VerseScope {
  books: string[];
  chapterRanges?: {
    book: string;
    startChapter: number;
    endChapter: number;
  }[];
}

/**
 * Does a verse reference fall inside a scope?
 *
 * - An empty `books` list matches every verse (the "whole corpus" scope).
 * - Otherwise the verse's book must be listed, AND — when a chapter range is
 *   present for that book — its chapter must fall within `[startChapter,
 *   endChapter]`. A book listed without a range matches all of its chapters.
 */
export function verseMatchesScope(
  ref: { book: string; chapter: number },
  scope: VerseScope,
): boolean {
  if (scope.books.length === 0) return true;
  if (!scope.books.includes(ref.book)) return false;

  const range = scope.chapterRanges?.find((r) => r.book === ref.book);
  if (!range) return true;
  return ref.chapter >= range.startChapter && ref.chapter <= range.endChapter;
}
