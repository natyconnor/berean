import { displayBookName } from "./bible-books";
import { getChapterVerseCount } from "./bible-verse-counts";
import type { VerseSpan } from "./hearted-verse-coverage";
import { verseMatchesScope, type VerseScope } from "./verse-scope-match";

/**
 * Verse bounds of a passage that starts or ends mid-chapter, in one book
 * (`packs.passageRange`). It may cross chapters. Convex imports this module,
 * so it must only use relative imports.
 */
export type PassageRange = {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
};

export type ChapterVerseCount = (
  book: string,
  chapter: number,
) => number | null;

const EN_DASH = "\u2013";

/** Whether one verse falls inside the range. */
export function verseInRange(
  ref: { book: string; chapter: number; verse: number },
  range: PassageRange,
): boolean {
  if (ref.book !== range.book) return false;
  if (ref.chapter < range.startChapter || ref.chapter > range.endChapter) {
    return false;
  }
  if (ref.chapter === range.startChapter && ref.verse < range.startVerse) {
    return false;
  }
  return !(ref.chapter === range.endChapter && ref.verse > range.endVerse);
}

/** Whether every verse of a one-chapter span falls inside the range. */
export function spanInRange(span: VerseSpan, range: PassageRange): boolean {
  return (
    verseInRange({ ...span, verse: span.startVerse }, range) &&
    verseInRange({ ...span, verse: span.endVerse }, range)
  );
}

/**
 * Whether a span belongs to a scope pack: inside its chapters and, when the
 * pack is a partial-chapter passage, inside its range.
 */
export function spanInPackScope(
  span: VerseSpan,
  scope: VerseScope,
  range: PassageRange | null | undefined,
): boolean {
  return verseMatchesScope(span, scope) && (!range || spanInRange(span, range));
}

/**
 * One span per chapter of the range, in order, or `null` when the range is
 * out of order or runs past a chapter's last verse.
 */
export function rangeChapterSpans(
  range: PassageRange,
  chapterVerseCount: ChapterVerseCount = getChapterVerseCount,
): VerseSpan[] | null {
  const { book, startChapter, startVerse, endChapter, endVerse } = range;
  const whole = [startChapter, startVerse, endChapter, endVerse].every(
    (value) => Number.isInteger(value) && value >= 1,
  );
  if (!whole || endChapter < startChapter) return null;

  const spans: VerseSpan[] = [];
  for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
    const verses = chapterVerseCount(book, chapter);
    if (verses === null) return null;
    const first = chapter === startChapter ? startVerse : 1;
    const last = chapter === endChapter ? endVerse : verses;
    if (first > last || last > verses) return null;
    spans.push({ book, chapter, startVerse: first, endVerse: last });
  }
  return spans;
}

/** Verses in the range by the static counts, or `null` when it is invalid. */
export function rangeVerseCount(
  range: PassageRange,
  chapterVerseCount: ChapterVerseCount = getChapterVerseCount,
): number | null {
  const spans = rangeChapterSpans(range, chapterVerseCount);
  if (!spans) return null;
  return spans.reduce(
    (sum, span) => sum + span.endVerse - span.startVerse + 1,
    0,
  );
}

/** Whether `chapter` lies wholly inside the range. */
export function rangeCoversChapter(
  range: PassageRange,
  chapter: number,
  chapterVerseCount: ChapterVerseCount = getChapterVerseCount,
): boolean {
  if (chapter < range.startChapter || chapter > range.endChapter) return false;
  if (chapter === range.startChapter && range.startVerse > 1) return false;
  if (chapter !== range.endChapter) return true;
  const verses = chapterVerseCount(range.book, chapter);
  return verses !== null && range.endVerse >= verses;
}

/** Whether the range is whole chapters (no verse bounds needed). */
export function rangeCoversWholeChapters(
  range: PassageRange,
  chapterVerseCount: ChapterVerseCount = getChapterVerseCount,
): boolean {
  return (
    range.startVerse === 1 &&
    rangeCoversChapter(range, range.endChapter, chapterVerseCount)
  );
}

/** "Philippians 2:1–11", "Romans 7:24–8:2", "John 3:16". */
export function formatPassageRange(range: PassageRange): string {
  const book = displayBookName(range.book);
  const start = `${book} ${range.startChapter}:${range.startVerse}`;
  if (range.startChapter !== range.endChapter) {
    return `${start}${EN_DASH}${range.endChapter}:${range.endVerse}`;
  }
  if (range.startVerse === range.endVerse) return start;
  return `${start}${EN_DASH}${range.endVerse}`;
}

/** A chapter's verses with everything outside the range dropped. */
export function trimChapterVerses<V extends { number: number }>(
  chapter: { book: string; chapter: number; verses: readonly V[] },
  range: PassageRange,
): { book: string; chapter: number; verses: V[] } {
  return {
    book: chapter.book,
    chapter: chapter.chapter,
    verses: chapter.verses.filter((verse) =>
      verseInRange(
        { book: chapter.book, chapter: chapter.chapter, verse: verse.number },
        range,
      ),
    ),
  };
}

/**
 * The one contiguous run the spans cover together, or `null` when they are
 * in more than one book or leave a gap. Spans may overlap or come in any
 * order; a run that crosses chapters must reach each chapter's last verse.
 */
export function contiguousRange(
  spans: readonly VerseSpan[],
  chapterVerseCount: ChapterVerseCount = getChapterVerseCount,
): PassageRange | null {
  const first = spans[0];
  if (!first || spans.some((span) => span.book !== first.book)) return null;

  const versesByChapter = new Map<number, Set<number>>();
  for (const span of spans) {
    let verses = versesByChapter.get(span.chapter);
    if (!verses) {
      verses = new Set();
      versesByChapter.set(span.chapter, verses);
    }
    for (let verse = span.startVerse; verse <= span.endVerse; verse += 1) {
      verses.add(verse);
    }
  }

  const chapters = [...versesByChapter.keys()].sort((a, b) => a - b);
  const startChapter = chapters[0];
  const endChapter = chapters[chapters.length - 1];
  if (startChapter === undefined || endChapter === undefined) return null;
  if (endChapter - startChapter + 1 !== chapters.length) return null;

  let startVerse = 0;
  let endVerse = 0;
  for (const chapter of chapters) {
    const verses = [...(versesByChapter.get(chapter) ?? [])];
    const low = Math.min(...verses);
    const high = Math.max(...verses);
    if (high - low + 1 !== verses.length) return null;
    if (chapter > startChapter && low !== 1) return null;
    if (
      chapter < endChapter &&
      high !== chapterVerseCount(first.book, chapter)
    ) {
      return null;
    }
    if (chapter === startChapter) startVerse = low;
    if (chapter === endChapter) endVerse = high;
  }

  return {
    book: first.book,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
  };
}
