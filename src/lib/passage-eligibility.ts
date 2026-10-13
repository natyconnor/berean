import { getChapterVerseCount } from "./bible-verse-counts";
import { scopeChaptersAreContiguous } from "./contiguous-spans";
import {
  rangeVerseCount,
  type ChapterVerseCount,
  type PassageRange,
} from "./passage-range";
import {
  AUTO_HEART_MAX_CHAPTERS,
  countScopeChapters,
} from "./scope-chapter-count";
import type { VerseScope } from "./verse-scope-match";

/** Fewest verses memorized as a passage; fewer is one verse card. */
export const MIN_PASSAGE_VERSES = 4;

/**
 * Fewest learning pieces a passage needs. A target that groups into one
 * piece (see `groupChapterForHearting`) is memorized as one verse card.
 */
export const MIN_PASSAGE_PIECES = 2;

/**
 * Whether a scope pack may opt into passage mode: one contiguous book range
 * of 1..{@link AUTO_HEART_MAX_CHAPTERS} chapters. Pack `kind` is checked by
 * callers; this helper only sees {@link VerseScope}.
 */
export function packAllowsPassageMode(scope: VerseScope): boolean {
  if (!scopeChaptersAreContiguous(scope)) return false;
  const chapterCount = countScopeChapters(scope);
  return chapterCount >= 1 && chapterCount <= AUTO_HEART_MAX_CHAPTERS;
}

/**
 * Whether a partial-chapter range may be a passage: in order, within the
 * book's verse counts, at most {@link AUTO_HEART_MAX_CHAPTERS} chapters, and
 * at least {@link MIN_PASSAGE_VERSES} verses. The single-piece guard needs
 * verse text, so it is {@link piecesAllowPassageMode}.
 */
export function rangeAllowsPassageMode(
  range: PassageRange,
  chapterVerseCount: ChapterVerseCount = getChapterVerseCount,
): boolean {
  if (range.endChapter - range.startChapter + 1 > AUTO_HEART_MAX_CHAPTERS) {
    return false;
  }
  const verses = rangeVerseCount(range, chapterVerseCount);
  return verses !== null && verses >= MIN_PASSAGE_VERSES;
}

/** Whether frozen pieces are enough for a passage rather than one card. */
export function piecesAllowPassageMode(pieceCount: number): boolean {
  return pieceCount >= MIN_PASSAGE_PIECES;
}
