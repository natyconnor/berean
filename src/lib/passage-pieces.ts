import type { EsvVerse } from "../../shared/esv-api";
import { groupChapterForHearting } from "./memory-span-group";

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
 * A new section starts when the chapter changes or the piece's first verse
 * has a heading/subheading. `sectionLabel` is set on the first piece of each
 * section: heading || subheading || `Chapter ${n}`.
 */
export function buildPassagePieces(
  chapters: readonly PassageChapterInput[],
): PassagePieceBase[] {
  const pieces: PassagePieceBase[] = [];
  let index = 0;
  let sectionIndex = -1;
  let lastBook: string | undefined;
  let lastChapter: number | undefined;

  for (const chapter of chapters) {
    const groups = groupChapterForHearting(
      chapter.book,
      chapter.chapter,
      chapter.verses,
      [],
    );
    const byNumber = new Map(
      chapter.verses.map((verse) => [verse.number, verse]),
    );

    for (const group of groups) {
      const firstVerse = byNumber.get(group.startVerse);
      const headingText = firstVerse?.heading || firstVerse?.subheading;
      const chapterChanged =
        lastBook !== group.book || lastChapter !== group.chapter;
      const startsSection =
        sectionIndex < 0 || chapterChanged || Boolean(headingText);

      if (startsSection) sectionIndex += 1;

      const piece: PassagePieceBase = {
        index,
        book: group.book,
        chapter: group.chapter,
        startVerse: group.startVerse,
        endVerse: group.endVerse,
        sectionIndex,
      };
      if (startsSection) {
        piece.sectionLabel = headingText || `Chapter ${group.chapter}`;
      }

      pieces.push(piece);
      index += 1;
      lastBook = group.book;
      lastChapter = group.chapter;
    }
  }

  return pieces;
}
