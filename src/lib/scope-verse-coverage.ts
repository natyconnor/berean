import { getChapterVerseCount } from "./bible-verse-counts";
import { spanCoversVerse, type VerseSpan } from "./hearted-verse-coverage";
import { enumerateScopeChapters } from "./scope-chapter-count";
import type { VerseScope } from "./verse-scope-match";

function heartsCoverVerse(
  hearts: readonly VerseSpan[],
  book: string,
  chapter: number,
  verse: number,
): boolean {
  return hearts.some(
    (heart) =>
      heart.book === book &&
      heart.chapter === chapter &&
      spanCoversVerse(heart, verse),
  );
}

function chapterSlotCount(book: string, chapter: number): number {
  return getChapterVerseCount(book, chapter) ?? 0;
}

/** Sum of `1..getChapterVerseCount` slots across enumerated chapters. */
export function scopeVerseSlots(scope: VerseScope): number {
  let total = 0;
  for (const { book, chapter } of enumerateScopeChapters(scope)) {
    total += chapterSlotCount(book, chapter);
  }
  return total;
}

/** Distinct verse numbers in the scope covered by any matching heart. */
export function coveredVerseCount(
  scope: VerseScope,
  hearts: readonly VerseSpan[],
): number {
  let covered = 0;
  for (const { book, chapter } of enumerateScopeChapters(scope)) {
    const verseCount = chapterSlotCount(book, chapter);
    for (let verse = 1; verse <= verseCount; verse += 1) {
      if (heartsCoverVerse(hearts, book, chapter, verse)) covered += 1;
    }
  }
  return covered;
}

/**
 * True iff every verse number in every enumerated chapter is covered by some
 * heart that matches that book and chapter.
 */
export function scopeCoverageComplete(
  scope: VerseScope,
  hearts: readonly VerseSpan[],
): boolean {
  for (const { book, chapter } of enumerateScopeChapters(scope)) {
    const verseCount = chapterSlotCount(book, chapter);
    for (let verse = 1; verse <= verseCount; verse += 1) {
      if (!heartsCoverVerse(hearts, book, chapter, verse)) return false;
    }
  }
  return true;
}
