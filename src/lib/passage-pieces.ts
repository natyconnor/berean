import type { EsvVerse } from "../../shared/esv-api";
import { groupChapterForHearting } from "./memory-span-group";
import { applyLearningSections } from "./passage-sections";

export type PassagePieceBase = {
  index: number;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  sectionIndex: number;
  sectionLabel?: string;
};

export type PieceAttachment = "unreached" | "learning" | "attached" | "solid";

export type PassagePiece = PassagePieceBase & {
  attachment: PieceAttachment;
  learnStage: number;
  stageReps: number;
  dueAt?: number;
};

export type PassageChapterInput = {
  book: string;
  chapter: number;
  verses: readonly EsvVerse[];
};

/**
 * Derive frozen piece spans from chapter text. Always groups with empty
 * existing hearts so user hearts never fragment the list.
 *
 * Learning sections are packed to about 5–8 verses (see
 * {@link applyLearningSections}). Chapter changes always start a new section;
 * ESV headings do not.
 */
export function buildPassagePieces(
  chapters: readonly PassageChapterInput[],
): PassagePieceBase[] {
  const pieces: PassagePieceBase[] = [];
  let index = 0;

  for (const chapter of chapters) {
    const groups = groupChapterForHearting(
      chapter.book,
      chapter.chapter,
      chapter.verses,
      [],
    );

    for (const group of groups) {
      pieces.push({
        index,
        book: group.book,
        chapter: group.chapter,
        startVerse: group.startVerse,
        endVerse: group.endVerse,
        sectionIndex: 0,
      });
      index += 1;
    }
  }

  return applyLearningSections(pieces);
}
