import { describe, expect, it } from "vitest";

import type { PassageVerseState } from "./passage-heart-info";
import { passageRailSegments } from "./passage-rail";

function states(
  ...entries: Array<[number, PassageVerseState]>
): { verse: number; state: PassageVerseState }[] {
  return entries.map(([verse, state]) => ({ verse, state }));
}

describe("passageRailSegments", () => {
  it("draws one segment per verse: solid, dashed, faint", () => {
    const segments = passageRailSegments({
      verseStates: states(
        [1, "memorized"],
        [2, "memorized"],
        [3, "learning"],
        [4, "upNext"],
      ),
      isFirstChapter: true,
    });

    expect(segments).toEqual([
      { verse: 1, stroke: "solid", joinsAbove: false, heart: true },
      { verse: 2, stroke: "solid", joinsAbove: true, heart: false },
      { verse: 3, stroke: "dashed", joinsAbove: true, heart: false },
      { verse: 4, stroke: "faint", joinsAbove: true, heart: false },
    ]);
  });

  it("puts the heart on the only verse of a one-verse passage", () => {
    expect(
      passageRailSegments({
        verseStates: states([7, "learning"]),
        isFirstChapter: true,
      }),
    ).toEqual([{ verse: 7, stroke: "dashed", joinsAbove: false, heart: true }]);
  });

  describe("across a chapter boundary", () => {
    // Matthew 5:47–6:2: 5:47–48 memorized, 6:1 learning, 6:2 up next.
    it("starts with the heart in the first chapter", () => {
      const fifth = passageRailSegments({
        verseStates: states([47, "memorized"], [48, "memorized"]),
        isFirstChapter: true,
      });
      expect(fifth.map((s) => [s.verse, s.heart])).toEqual([
        [47, true],
        [48, false],
      ]);
    });

    it("continues with no heart in a later chapter", () => {
      const sixth = passageRailSegments({
        verseStates: states([1, "learning"], [2, "upNext"]),
        isFirstChapter: false,
      });
      expect(sixth).toEqual([
        { verse: 1, stroke: "dashed", joinsAbove: false, heart: false },
        { verse: 2, stroke: "faint", joinsAbove: true, heart: false },
      ]);
    });
  });

  it("sorts verses and does not join across a gap", () => {
    const segments = passageRailSegments({
      verseStates: states([5, "upNext"], [2, "memorized"], [3, "memorized"]),
      isFirstChapter: true,
    });
    expect(segments.map((s) => [s.verse, s.joinsAbove])).toEqual([
      [2, false],
      [3, true],
      [5, false],
    ]);
    expect(segments[0]?.heart).toBe(true);
  });

  it("is empty when the chapter has no verses of the passage", () => {
    expect(
      passageRailSegments({ verseStates: [], isFirstChapter: true }),
    ).toEqual([]);
  });
});
