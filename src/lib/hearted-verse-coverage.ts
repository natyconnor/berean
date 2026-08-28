/**
 * Pure span-coverage helpers for hearted verses.
 *
 * Hearts stay exact spans; overlay math is derived from the caller's
 * `heartedVerses` array. Different books or chapters never overlap.
 */

/** Max spans per `heartMany` call; the client must chunk larger batches. */
export const HEART_MANY_CHUNK = 40;

export type VerseSpan = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

function sameChapter(a: VerseSpan, b: Pick<VerseSpan, "book" | "chapter">) {
  return a.book === b.book && a.chapter === b.chapter;
}

/** True when `startVerse <= verse <= endVerse` on this span. */
export function spanCoversVerse(span: VerseSpan, verse: number): boolean {
  return span.startVerse <= verse && verse <= span.endVerse;
}

/** Hearted spans in this chapter that cover `verse`. */
export function coveringSpans(
  spans: readonly VerseSpan[],
  book: string,
  chapter: number,
  verse: number,
): VerseSpan[] {
  return spans.filter(
    (span) =>
      sameChapter(span, { book, chapter }) && spanCoversVerse(span, verse),
  );
}

/** Inclusive range overlap on the same book and chapter. */
export function spansOverlap(a: VerseSpan, b: VerseSpan): boolean {
  if (!sameChapter(a, b)) return false;
  return a.startVerse <= b.endVerse && b.startVerse <= a.endVerse;
}

export function overlappingSpans<T extends VerseSpan>(
  selection: VerseSpan,
  spans: readonly T[],
): T[] {
  return spans.filter((span) => spansOverlap(selection, span));
}

export function exactSpanMatch<T extends VerseSpan>(
  selection: VerseSpan,
  spans: readonly T[],
): T | null {
  return (
    spans.find(
      (span) =>
        sameChapter(span, selection) &&
        span.startVerse === selection.startVerse &&
        span.endVerse === selection.endVerse,
    ) ?? null
  );
}

/**
 * Union covered verses in a chapter, then group contiguous runs.
 * Used to paint muted coverage; not a new selection model.
 * Overlapping saved spans (16–18 and 16) union to one run 16–18.
 */
export function heartedRunsForChapter(
  spans: readonly VerseSpan[],
  book: string,
  chapter: number,
  verseCount: number,
): Array<{ start: number; end: number }> {
  if (verseCount <= 0) return [];

  const covered = new Array<boolean>(verseCount + 1).fill(false);
  for (const span of spans) {
    if (!sameChapter(span, { book, chapter })) continue;
    const start = Math.max(1, span.startVerse);
    const end = Math.min(verseCount, span.endVerse);
    for (let verse = start; verse <= end; verse += 1) {
      covered[verse] = true;
    }
  }

  const runs: Array<{ start: number; end: number }> = [];
  let runStart: number | null = null;
  for (let verse = 1; verse <= verseCount; verse += 1) {
    if (covered[verse]) {
      if (runStart === null) runStart = verse;
      continue;
    }
    if (runStart !== null) {
      runs.push({ start: runStart, end: verse - 1 });
      runStart = null;
    }
  }
  if (runStart !== null) {
    runs.push({ start: runStart, end: verseCount });
  }
  return runs;
}
