import { describe, expect, it } from "vitest";

import {
  carriedOverSessionNotice,
  carriedOverSheetLine,
} from "./carried-over-copy";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";

function carried(startVerse: number, memorized: boolean, chapter = 1) {
  return {
    book: "Psalms",
    chapter,
    startVerse,
    endVerse: startVerse,
    memorized,
  };
}

function piece(
  index: number,
  startVerse: number,
  attachment: PieceAttachment,
  extra?: Partial<PassagePiece>,
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 1,
    startVerse,
    endVerse: startVerse,
    sectionIndex: 0,
    attachment,
    learnStage: attachment === "solid" ? 3 : 0,
    stageReps: 0,
    ...extra,
  };
}

describe("carriedOverSheetLine", () => {
  it("says nothing without carried-over verses", () => {
    expect(carriedOverSheetLine(undefined)).toBeNull();
    expect(carriedOverSheetLine([])).toBeNull();
  });

  it("counts a memorized verse as learned", () => {
    expect(carriedOverSheetLine([carried(3, true)])).toBe(
      "You've already memorized Psalm 1:3. It counts as learned.",
    );
    expect(carriedOverSheetLine([carried(3, true), carried(5, true)])).toBe(
      "You've already memorized Psalm 1:3 and 1:5. They count as learned.",
    );
  });

  it("carries over progress when any verse is still being learned", () => {
    expect(carriedOverSheetLine([carried(3, true), carried(5, false)])).toBe(
      "You've already started Psalm 1:3 and 1:5. That progress carries over.",
    );
  });

  it("labels ranges and later chapters", () => {
    expect(
      carriedOverSheetLine([
        { ...carried(3, true), endVerse: 4 },
        carried(1, true, 2),
      ]),
    ).toBe(
      "You've already memorized Psalm 1:3\u20134 and 2:1. They count as learned.",
    );
  });
});

describe("carriedOverSessionNotice", () => {
  it("is null when nothing carried over", () => {
    expect(
      carriedOverSessionNotice([
        piece(0, 1, "solid"),
        piece(1, 2, "unreached"),
      ]),
    ).toBeNull();
  });

  it("skips ahead past one memorized verse", () => {
    expect(
      carriedOverSessionNotice([
        piece(0, 1, "unreached"),
        piece(1, 2, "unreached"),
        piece(2, 3, "solid", { carriedOver: true }),
      ]),
    ).toBe("Verse 3 is already memorized, so we'll skip ahead.");
  });

  it("lists several memorized verses and joins neighbors into a range", () => {
    expect(
      carriedOverSessionNotice([
        piece(0, 1, "unreached"),
        piece(1, 3, "solid", { carriedOver: true }),
        piece(2, 5, "solid", { carriedOver: true }),
      ]),
    ).toBe("Verses 3 and 5 are already memorized, so we'll skip ahead.");
    expect(
      carriedOverSessionNotice([
        piece(0, 3, "solid", { carriedOver: true }),
        piece(1, 4, "solid", { carriedOver: true }),
        piece(2, 5, "unreached"),
      ]),
    ).toBe("Verses 3\u20134 are already memorized, so we'll skip ahead.");
  });

  it("adds chapters when the passage spans more than one", () => {
    expect(
      carriedOverSessionNotice([
        piece(0, 6, "unreached"),
        piece(1, 1, "solid", { chapter: 2, carriedOver: true }),
      ]),
    ).toBe("Verse 2:1 is already memorized, so we'll skip ahead.");
  });

  it("resumes started verses when none are memorized", () => {
    expect(
      carriedOverSessionNotice([
        piece(0, 1, "unreached"),
        piece(1, 2, "attached", { carriedOver: true, learnStage: 2 }),
      ]),
    ).toBe("You'd already started verse 2, so it picks up where you left off.");
    expect(
      carriedOverSessionNotice([
        piece(0, 2, "learning", { carriedOver: true, learnStage: 1 }),
        piece(1, 4, "attached", { carriedOver: true, learnStage: 2 }),
      ]),
    ).toBe(
      "You'd already started verses 2 and 4, so they pick up where you left off.",
    );
  });
});
