import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import type { VerseRef } from "@/lib/verse-ref-utils";

export type VerseRangeEnd = "start" | "end";
export type VerseRangeNudge = "grow" | "shrink";

export interface VerseRangeBounds {
  canGrowStart: boolean;
  canShrinkStart: boolean;
  canGrowEnd: boolean;
  canShrinkEnd: boolean;
}

export function chapterVerseMax(book: string, chapter: number): number | null {
  return getChapterVerseCount(book, chapter);
}

export function verseRangeBounds(
  ref: Pick<VerseRef, "startVerse" | "endVerse">,
  maxVerse: number | null,
): VerseRangeBounds {
  const isRange = ref.endVerse > ref.startVerse;
  return {
    canGrowStart: ref.startVerse > 1,
    canShrinkStart: isRange,
    canGrowEnd: maxVerse !== null && ref.endVerse < maxVerse,
    canShrinkEnd: isRange,
  };
}

export function nudgeVerseRange(
  ref: VerseRef,
  end: VerseRangeEnd,
  nudge: VerseRangeNudge,
  maxVerse: number | null,
): VerseRef | null {
  const bounds = verseRangeBounds(ref, maxVerse);
  if (end === "start") {
    if (nudge === "grow") {
      if (!bounds.canGrowStart) return null;
      return { ...ref, startVerse: ref.startVerse - 1 };
    }
    if (!bounds.canShrinkStart) return null;
    return { ...ref, startVerse: ref.startVerse + 1 };
  }
  if (nudge === "grow") {
    if (!bounds.canGrowEnd) return null;
    return { ...ref, endVerse: ref.endVerse + 1 };
  }
  if (!bounds.canShrinkEnd) return null;
  return { ...ref, endVerse: ref.endVerse - 1 };
}
