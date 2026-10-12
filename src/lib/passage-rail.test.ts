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
      isLastChapter: true,
    });

    expect(segments).toEqual([
      {
        verse: 1,
        stroke: "solid",
        joinsAbove: false,
        heart: true,
        foot: false,
      },
      {
        verse: 2,
        stroke: "solid",
        joinsAbove: true,
        heart: false,
        foot: false,
      },
      {
        verse: 3,
        stroke: "dashed",
        joinsAbove: true,
        heart: false,
        foot: false,
      },
      { verse: 4, stroke: "faint", joinsAbove: true, heart: false, foot: true },
    ]);
  });

  it("puts the heart and foot on the same verse for a one-verse passage", () => {
    expect(
      passageRailSegments({
        verseStates: states([7, "learning"]),
        isFirstChapter: true,
        isLastChapter: true,
      }),
    ).toEqual([
      {
        verse: 7,
        stroke: "dashed",
        joinsAbove: false,
        heart: true,
        foot: true,
      },
    ]);
  });

  describe("across a chapter boundary", () => {
    // Matthew 5:47–6:2: 5:47–48 memorized, 6:1 learning, 6:2 up next.
    it("starts with the heart and runs off the end of the first chapter", () => {
      const fifth = passageRailSegments({
        verseStates: states([47, "memorized"], [48, "memorized"]),
        isFirstChapter: true,
        isLastChapter: false,
      });
      expect(fifth.map((s) => [s.verse, s.heart, s.foot])).toEqual([
        [47, true, false],
        [48, false, false],
      ]);
    });

    it("continues with no heart and ends in the foot in the last chapter", () => {
      const sixth = passageRailSegments({
        verseStates: states([1, "learning"], [2, "upNext"]),
        isFirstChapter: false,
        isLastChapter: true,
      });
      expect(sixth).toEqual([
        {
          verse: 1,
          stroke: "dashed",
          joinsAbove: false,
          heart: false,
          foot: false,
        },
        {
          verse: 2,
          stroke: "faint",
          joinsAbove: true,
          heart: false,
          foot: true,
        },
      ]);
    });

    it("has neither heart nor foot in a middle chapter", () => {
      const middle = passageRailSegments({
        verseStates: states([1, "upNext"], [2, "upNext"]),
        isFirstChapter: false,
        isLastChapter: false,
      });
      expect(middle.some((s) => s.heart || s.foot)).toBe(false);
    });
  });

  it("sorts verses and does not join across a gap", () => {
    const segments = passageRailSegments({
      verseStates: states([5, "upNext"], [2, "memorized"], [3, "memorized"]),
      isFirstChapter: true,
      isLastChapter: true,
    });
    expect(segments.map((s) => [s.verse, s.joinsAbove])).toEqual([
      [2, false],
      [3, true],
      [5, false],
    ]);
    expect(segments[0]?.heart).toBe(true);
    expect(segments[2]?.foot).toBe(true);
  });

  it("is empty when the chapter has no verses of the passage", () => {
    expect(
      passageRailSegments({
        verseStates: [],
        isFirstChapter: true,
        isLastChapter: true,
      }),
    ).toEqual([]);
  });
});
