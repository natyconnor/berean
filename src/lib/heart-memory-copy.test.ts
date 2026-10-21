import { describe, expect, it } from "vitest";

import {
  passageHeartCopy,
  verseHeartLabels,
  verseHeartMemoryCopy,
} from "./heart-memory-copy";

// Monday, October 12, 2026, 3pm UTC.
const NOW = Date.UTC(2026, 9, 12, 15);
const THURSDAY = Date.UTC(2026, 9, 15, 9);

describe("verseHeartMemoryCopy", () => {
  it("says what today's learning step is", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "learning", learnStage: 2, dueAt: NOW - 1 },
        NOW,
        "UTC",
      ),
    ).toEqual({
      tooltip: "Memorizing\u00A0· Fill in the blanks",
      ariaLabel: "Memorizing: Fill in the blanks. Unheart",
    });
  });

  it("names an up-next pack verse as memorizing", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "new", learnStage: 0, dueAt: NOW },
        NOW,
        "UTC",
      ).tooltip,
    ).toBe("Memorizing\u00A0· Up next. Starts when you're ready.");
  });

  it("names the next review of a memorized verse", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "reviewing", learnStage: 3, dueAt: THURSDAY },
        NOW,
        "UTC",
      ),
    ).toEqual({
      tooltip: "Memorized\u00A0· next review Thu",
      ariaLabel: "Memorized: next review Thu. Unheart",
    });
    expect(
      verseHeartMemoryCopy(
        { status: "reviewing", learnStage: 3, dueAt: NOW - 1 },
        NOW,
        "UTC",
      ).tooltip,
    ).toBe("Memorized\u00A0· review due today");
  });

  it("says Mastered and nothing else for a mastered verse", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "mastered", learnStage: 3, dueAt: THURSDAY },
        NOW,
        "UTC",
      ),
    ).toEqual({ tooltip: "Mastered", ariaLabel: "Mastered. Unheart" });
  });
});

describe("verseHeartLabels", () => {
  it("names each hearted state with matching tooltip and accessible name", () => {
    expect(verseHeartLabels(false, false)).toEqual({
      tooltip: "Heart Verse",
      ariaLabel: "Heart Verse",
    });
    expect(verseHeartLabels(true, true)).toEqual({
      tooltip: "Memorize or unheart",
      ariaLabel: "Memorize or unheart",
    });
    expect(verseHeartLabels(true, false)).toEqual({
      tooltip: "Unheart",
      ariaLabel: "Unheart",
    });
  });

  it("uses Memory copy when the verse is in Memory", () => {
    const memoryCopy = verseHeartMemoryCopy(
      { status: "learning", learnStage: 2, dueAt: NOW - 1 },
      NOW,
      "UTC",
    );
    expect(verseHeartLabels(true, false, memoryCopy)).toEqual(memoryCopy);
    expect(memoryCopy.tooltip.startsWith("Memorizing\u00A0·")).toBe(true);
  });
});

describe("passageHeartCopy", () => {
  const psalm16 = {
    title: "Psalm 16",
    learnedVerses: 4,
    totalVerses: 11,
    dueAt: THURSDAY,
  };

  it("counts learned verses while memorizing", () => {
    expect(
      passageHeartCopy({ ...psalm16, status: "building" }, NOW, "UTC"),
    ).toEqual({
      tooltip: "Psalm 16 · memorizing · 4 of 11 learned",
      ariaLabel:
        "Psalm 16, hearted. Memorizing: 4 of 11 verses learned. Remove heart",
    });
  });

  it("names the next recite once memorized", () => {
    expect(
      passageHeartCopy({ ...psalm16, status: "reviewing" }, NOW, "UTC"),
    ).toEqual({
      tooltip: "Psalm 16 · memorized · next review Thu",
      ariaLabel: "Psalm 16, hearted. Memorized: next review Thu. Remove heart",
    });
  });

  it("says mastered", () => {
    expect(
      passageHeartCopy({ ...psalm16, status: "mastered" }, NOW, "UTC"),
    ).toEqual({
      tooltip: "Psalm 16 · mastered",
      ariaLabel: "Psalm 16, hearted. Mastered. Remove heart",
    });
  });
});
