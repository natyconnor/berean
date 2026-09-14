/**
 * Canonical equality for pack / study-session scopes.
 *
 * Array order is ignored for `books`, `tags`, and `chapterRanges`. Missing vs
 * empty `chapterRanges` are the same. A range that covers an entire book
 * (1..N chapters) is treated as “no range” for that book, matching pack-builder
 * whole-book scopes so Jude (whole book) and Jude 1–1 cannot both exist.
 */

import { BOOK_BY_NAME } from "./bible-books";

export interface FullScope {
  books: string[];
  chapterRanges?: {
    book: string;
    startChapter: number;
    endChapter: number;
  }[];
  tags: string[];
  tagMatchMode: "any" | "all";
}

function sortedBooks(books: string[]): string[] {
  return [...books].sort((a, b) => a.localeCompare(b));
}

function sortedTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function isWholeBookRange(
  book: string,
  startChapter: number,
  endChapter: number,
): boolean {
  const info = BOOK_BY_NAME.get(book);
  if (!info) return false;
  return startChapter === 1 && endChapter === info.chapters;
}

/**
 * Drop whole-book ranges so `{ books: ["Jude"] }` and
 * `{ books: ["Jude"], chapterRanges: [{ Jude, 1, 1 }] }` compare equal.
 */
export function canonicalChapterRanges(
  books: readonly string[],
  ranges: FullScope["chapterRanges"],
): Array<{ book: string; startChapter: number; endChapter: number }> {
  const bookSet = new Set(books);
  const partial: Array<{
    book: string;
    startChapter: number;
    endChapter: number;
  }> = [];
  for (const range of ranges ?? []) {
    if (!bookSet.has(range.book)) continue;
    if (isWholeBookRange(range.book, range.startChapter, range.endChapter)) {
      continue;
    }
    partial.push({
      book: range.book,
      startChapter: range.startChapter,
      endChapter: range.endChapter,
    });
  }
  return partial.sort((a, b) => {
    const byBook = a.book.localeCompare(b.book);
    if (byBook !== 0) return byBook;
    if (a.startChapter !== b.startChapter) {
      return a.startChapter - b.startChapter;
    }
    return a.endChapter - b.endChapter;
  });
}

/** True when both scopes describe the same books / ranges / tags filter. */
export function scopesEqual(a: FullScope, b: FullScope): boolean {
  if (a.tagMatchMode !== b.tagMatchMode) return false;

  const aBooks = sortedBooks(a.books);
  const bBooks = sortedBooks(b.books);
  if (aBooks.length !== bBooks.length) return false;
  for (let i = 0; i < aBooks.length; i++) {
    if (aBooks[i] !== bBooks[i]) return false;
  }

  const aTags = sortedTags(a.tags);
  const bTags = sortedTags(b.tags);
  if (aTags.length !== bTags.length) return false;
  for (let i = 0; i < aTags.length; i++) {
    if (aTags[i] !== bTags[i]) return false;
  }

  const aRanges = canonicalChapterRanges(aBooks, a.chapterRanges);
  const bRanges = canonicalChapterRanges(bBooks, b.chapterRanges);
  if (aRanges.length !== bRanges.length) return false;
  for (let i = 0; i < aRanges.length; i++) {
    const left = aRanges[i];
    const right = bRanges[i];
    if (
      left.book !== right.book ||
      left.startChapter !== right.startChapter ||
      left.endChapter !== right.endChapter
    ) {
      return false;
    }
  }

  return true;
}
