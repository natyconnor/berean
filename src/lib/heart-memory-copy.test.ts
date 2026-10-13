import { describe, expect, it } from "vitest";

import { passageHeartCopy, verseHeartMemoryCopy } from "./heart-memory-copy";

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
      tooltip: "Memorizing · Fill in the blanks",
      ariaSuffix: "(memorizing, Fill in the blanks)",
    });
  });

  it("names an up-next pack verse as memorizing", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "new", learnStage: 0, dueAt: NOW },
        NOW,
        "UTC",
      ).tooltip,
    ).toBe("Memorizing · Up next. Starts when you're ready.");
  });

  it("names the next review of a memorized verse", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "reviewing", learnStage: 3, dueAt: THURSDAY },
        NOW,
        "UTC",
      ),
    ).toEqual({
      tooltip: "Memorized · next review Thu",
      ariaSuffix: "(memorized, next review Thu)",
    });
    expect(
      verseHeartMemoryCopy(
        { status: "reviewing", learnStage: 3, dueAt: NOW - 1 },
        NOW,
        "UTC",
      ).tooltip,
    ).toBe("Memorized · review due today");
  });

  it("says Mastered and nothing else for a mastered verse", () => {
    expect(
      verseHeartMemoryCopy(
        { status: "mastered", learnStage: 3, dueAt: THURSDAY },
        NOW,
        "UTC",
      ),
    ).toEqual({ tooltip: "Mastered", ariaSuffix: "(mastered)" });
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
