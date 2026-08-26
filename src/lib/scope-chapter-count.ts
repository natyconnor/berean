import { getBookInfo } from "./bible-books";
import type { VerseScope } from "./verse-scope-match";

/** Scopes larger than this cannot be auto-hearted in one pass. */
export const AUTO_HEART_MAX_CHAPTERS = 20;

export type ScopeChapter = {
  book: string;
  chapter: number;
};

/**
 * Every chapter a scope includes. Empty `books` is the whole corpus: returns
 * `[]` so {@link countScopeChapters} can signal Infinity instead of 0.
 * A listed book with no range expands via {@link getBookInfo}.
 */
export function enumerateScopeChapters(scope: VerseScope): ScopeChapter[] {
  if (scope.books.length === 0) return [];

  const chapters: ScopeChapter[] = [];
  for (const book of scope.books) {
    const range = scope.chapterRanges?.find((entry) => entry.book === book);
    if (range) {
      for (
        let chapter = range.startChapter;
        chapter <= range.endChapter;
        chapter += 1
      ) {
        chapters.push({ book, chapter });
      }
      continue;
    }

    const info = getBookInfo(book);
    if (!info) continue;
    for (let chapter = 1; chapter <= info.chapters; chapter += 1) {
      chapters.push({ book, chapter });
    }
  }
  return chapters;
}

/** Chapter count for the cap. Empty `books` → `Infinity`, not 0. */
export function countScopeChapters(scope: VerseScope): number {
  if (scope.books.length === 0) return Infinity;
  return enumerateScopeChapters(scope).length;
}

export function autoHeartAllowed(scope: VerseScope): boolean {
  const count = countScopeChapters(scope);
  return count > 0 && count <= AUTO_HEART_MAX_CHAPTERS;
}
