import { describe, expect, it } from "vitest";

import { passageHeartProgress } from "./passage-heart-info";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";

function piece(
  index: number,
  chapter: number,
  startVerse: number,
  endVerse: number,
  attachment: PieceAttachment,
  extra: Partial<PassagePiece> = {},
): PassagePiece {
  return {
    index,
    book: "Matthew",
    chapter,
    startVerse,
    endVerse,
    sectionIndex: 0,
    attachment,
    learnStage: attachment === "unreached" ? 0 : 2,
    stageReps: 0,
    dueAt: attachment === "unreached" ? undefined : 1,
    ...extra,
  };
}

describe("passageHeartProgress", () => {
  it("counts joined verses as learned and maps each verse to its state", () => {
    const pieces = [
      piece(0, 5, 1, 2, "solid"),
      piece(1, 5, 3, 3, "attached"),
      piece(2, 5, 4, 4, "learning"),
      piece(3, 5, 5, 6, "unreached"),
    ];

    expect(passageHeartProgress(pieces, "Matthew", 5)).toEqual({
      learnedVerses: 3,
      totalVerses: 6,
      chapterCount: 1,
      isFirstChapter: true,
      startVerse: 1,
      endVerse: 6,
      verseStates: [
        { verse: 1, state: "memorized" },
        { verse: 2, state: "memorized" },
        { verse: 3, state: "memorized" },
        { verse: 4, state: "learning" },
        { verse: 5, state: "upNext" },
        { verse: 6, state: "upNext" },
      ],
    });
  });

  it("counts the whole passage but slices states to the asked chapter", () => {
    const pieces = [
      piece(0, 5, 1, 48, "solid"),
      piece(1, 6, 1, 4, "learning"),
      piece(2, 6, 5, 34, "unreached"),
      piece(3, 7, 1, 29, "unreached"),
    ];

    const sixth = passageHeartProgress(pieces, "Matthew", 6);
    expect(sixth).toMatchObject({
      learnedVerses: 48,
      totalVerses: 48 + 34 + 29,
      chapterCount: 3,
      isFirstChapter: false,
      startVerse: 1,
      endVerse: 34,
    });
    expect(sixth?.verseStates).toHaveLength(34);
    expect(sixth?.verseStates[3]).toEqual({ verse: 4, state: "learning" });
    expect(sixth?.verseStates[4]).toEqual({ verse: 5, state: "upNext" });

    expect(passageHeartProgress(pieces, "Matthew", 5)?.isFirstChapter).toBe(
      true,
    );
  });

  it("treats a never-started learning piece as up next", () => {
    const pieces = [
      piece(0, 1, 1, 1, "learning", {
        learnStage: 0,
        stageReps: 0,
        dueAt: undefined,
      }),
    ];
    expect(passageHeartProgress(pieces, "Matthew", 1)?.verseStates).toEqual([
      { verse: 1, state: "upNext" },
    ]);
  });

  it("is null when no piece is in the chapter", () => {
    const pieces = [piece(0, 5, 1, 3, "solid")];
    expect(passageHeartProgress(pieces, "Matthew", 6)).toBeNull();
    expect(passageHeartProgress(pieces, "Mark", 5)).toBeNull();
  });
});
