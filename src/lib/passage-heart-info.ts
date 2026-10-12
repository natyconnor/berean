import { coerceUnstartedLearningPieces } from "./passage-frontier";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";

/** How one verse of a memorized passage is going, for the reader's rail. */
export type PassageVerseState = "memorized" | "learning" | "upNext";

export type PassageStatus = "building" | "reviewing" | "mastered";

/**
 * A passage's progress as seen from one chapter. Counts cover the whole
 * passage; `startVerse` / `endVerse` / `verseStates` cover this chapter only.
 */
export type PassageHeartProgress = {
  /** Verses in pieces that are joined into the passage (attached or solid). */
  learnedVerses: number;
  totalVerses: number;
  chapterCount: number;
  isFirstChapter: boolean;
  startVerse: number;
  endVerse: number;
  verseStates: { verse: number; state: PassageVerseState }[];
};

/** `PassageHeartProgress` plus the passage and its pack (`title` = pack name). */
export type PassageHeartInfo = PassageHeartProgress & {
  passageMemoryId: string;
  packId: string;
  title: string;
  status: PassageStatus;
};

const VERSE_STATE: Record<PieceAttachment, PassageVerseState> = {
  solid: "memorized",
  attached: "memorized",
  learning: "learning",
  unreached: "upNext",
};

/**
 * Progress of a passage for the heart row in `book` `chapter`, or `null` when
 * none of its pieces are in that chapter. Never-started "learning" pieces
 * count as up next, as in the passage session.
 */
export function passageHeartProgress(
  pieces: readonly PassagePiece[],
  book: string,
  chapter: number,
): PassageHeartProgress | null {
  let learnedVerses = 0;
  let totalVerses = 0;
  let firstChapter = Infinity;
  const chapters = new Set<number>();
  const verseStates: PassageHeartProgress["verseStates"] = [];

  for (const piece of coerceUnstartedLearningPieces(pieces)) {
    if (piece.book !== book) continue;
    const verses = piece.endVerse - piece.startVerse + 1;
    const state = VERSE_STATE[piece.attachment];
    totalVerses += verses;
    if (state === "memorized") learnedVerses += verses;
    chapters.add(piece.chapter);
    firstChapter = Math.min(firstChapter, piece.chapter);
    if (piece.chapter !== chapter) continue;
    for (let verse = piece.startVerse; verse <= piece.endVerse; verse += 1) {
      verseStates.push({ verse, state });
    }
  }

  verseStates.sort((a, b) => a.verse - b.verse);
  const first = verseStates[0];
  const last = verseStates[verseStates.length - 1];
  if (!first || !last) return null;

  return {
    learnedVerses,
    totalVerses,
    chapterCount: chapters.size,
    isFirstChapter: chapter === firstChapter,
    startVerse: first.verse,
    endVerse: last.verse,
    verseStates,
  };
}
