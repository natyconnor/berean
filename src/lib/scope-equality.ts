/**
 * Canonical equality for pack / study-session scopes.
 *
 * Array order is ignored for `books`, `tags`, and `chapterRanges` so two
 * scopes that describe the same filter compare equal. `chapterRanges`
 * missing vs empty are treated the same.
 */

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

function sortedRanges(
  ranges: FullScope["chapterRanges"],
): Array<{ book: string; startChapter: number; endChapter: number }> {
  if (!ranges || ranges.length === 0) return [];
  return [...ranges].sort((a, b) => {
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

  const aRanges = sortedRanges(a.chapterRanges);
  const bRanges = sortedRanges(b.chapterRanges);
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
