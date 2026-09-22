import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import type { VerseRef } from "@/lib/verse-ref-utils";

export type VerseRangeEnd = "start" | "end";
export type VerseRangeNudge = "grow" | "shrink";

export function verseRangeBounds(ref: Pick<VerseRef, "book" | "chapter">): {
  min: 1;
  max: number | null;
} {
  return {
    min: 1,
    max: getChapterVerseCount(ref.book, ref.chapter),
  };
}

export function canNudgeVerseRange(
  ref: VerseRef,
  end: VerseRangeEnd,
  nudge: VerseRangeNudge,
): boolean {
  if (ref.startVerse > ref.endVerse) return false;

  const { min, max } = verseRangeBounds(ref);
  const isSingle = ref.startVerse === ref.endVerse;

  if (nudge === "shrink") {
    return !isSingle;
  }

  if (end === "start") {
    return ref.startVerse > min;
  }

  if (max === null) return false;
  return ref.endVerse < max;
}

/**
 * Step one end of an in-chapter range by exactly one verse.
 * Returns null when the step would leave the chapter, skip a verse, or
 * shrink a single verse. Does not mutate `ref` and does not copy `scope`.
 */
export function nudgeVerseRange(
  ref: VerseRef,
  end: VerseRangeEnd,
  nudge: VerseRangeNudge,
): VerseRef | null {
  if (!canNudgeVerseRange(ref, end, nudge)) return null;

  let startVerse = ref.startVerse;
  let endVerse = ref.endVerse;

  if (end === "start" && nudge === "grow") startVerse -= 1;
  if (end === "start" && nudge === "shrink") startVerse += 1;
  if (end === "end" && nudge === "grow") endVerse += 1;
  if (end === "end" && nudge === "shrink") endVerse -= 1;

  return {
    book: ref.book,
    chapter: ref.chapter,
    startVerse,
    endVerse,
  };
}
