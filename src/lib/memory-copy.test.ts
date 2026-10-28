import { describe, expect, it } from "vitest";

import {
  ENTER_TO_CHECK_HINT,
  formatShakyVerseList,
  hasLearningProgress,
  learnActionLabel,
  memorizeTitleLabel,
  passageStepLine,
  shakyVersesOption,
  startOverTitle,
  statusLabel,
  stepAction,
  stepActionLine,
  stepLadderDay,
  stepShortLabel,
  todayStepParts,
} from "./memory-copy";

describe("stepShortLabel", () => {
  it("names each learning step", () => {
    expect([0, 1, 2, 3].map(stepShortLabel)).toEqual([
      "Read",
      "First letters",
      "Fill in the blanks",
      "From memory",
    ]);
  });

  it("clamps out-of-range stages", () => {
    expect(stepShortLabel(-1)).toBe("Read");
    expect(stepShortLabel(9)).toBe("From memory");
    expect(stepShortLabel(1.7)).toBe("First letters");
    expect(stepShortLabel(Number.NaN)).toBe("Read");
  });
});

describe("stepActionLine", () => {
  it("puts Read and First letters in one step", () => {
    expect(stepActionLine(0)).toBe("Read it, then type it with first letters");
    expect(stepActionLine(1)).toBe(stepActionLine(0));
  });

  it("names blanks and From memory without counting days", () => {
    expect(stepActionLine(2)).toBe("Fill in the blanks");
    expect(stepActionLine(3)).toBe("Say it from memory");
  });
});

describe("stepAction", () => {
  it("reads as the end of a sentence", () => {
    expect([0, 1, 2, 3].map(stepAction)).toEqual([
      "read it, then type it with first letters",
      "read it, then type it with first letters",
      "fill in the blanks",
      "say it from memory",
    ]);
  });
});

describe("stepLadderDay", () => {
  it("puts Read and First letters on day 1, then one step a day", () => {
    expect([0, 1, 2, 3].map(stepLadderDay)).toEqual([1, 1, 2, 3]);
    expect(stepLadderDay(-2)).toBe(1);
    expect(stepLadderDay(7)).toBe(3);
  });
});

describe("passageStepLine", () => {
  it("names the verses and today's step", () => {
    expect(passageStepLine(0, "verses 5–6", true)).toBe(
      "Read verses 5–6, then type them with first letters",
    );
    expect(passageStepLine(1, "verse 3", false)).toBe(
      "Read verse 3, then type it with first letters",
    );
    expect(passageStepLine(2, "verses 1–2", true)).toBe(
      "Fill in the blanks for verses 1–2",
    );
    expect(passageStepLine(3, "verse 7", false)).toBe(
      "Say verse 7 from memory",
    );
  });
});

describe("todayStepParts", () => {
  it("leads with Today and ends the step as a sentence", () => {
    expect(todayStepParts("Fill in the blanks for verses 1–2")).toEqual({
      lead: "Today:",
      rest: "fill in the blanks for verses 1–2.",
    });
    expect(
      todayStepParts("Read verse 3, then type it with first letters"),
    ).toEqual({
      lead: "Today:",
      rest: "read verse 3, then type it with first letters.",
    });
  });
});

describe("hasLearningProgress", () => {
  it("is false for a never-started Read verse", () => {
    expect(hasLearningProgress({ learnStage: 0 })).toBe(false);
    expect(learnActionLabel({ learnStage: 0 })).toBe("Learn");
  });

  it("stays true when lastReviewedAt is the only leftover", () => {
    expect(
      hasLearningProgress({ learnStage: 0, lastReviewedAt: 1_700_000_000_000 }),
    ).toBe(true);
    expect(
      learnActionLabel({ learnStage: 0, lastReviewedAt: 1_700_000_000_000 }),
    ).toBe("Continue learning");
  });
});

describe("statusLabel", () => {
  it("reads reviewing as Memorized", () => {
    expect(statusLabel("new")).toBe("New");
    expect(statusLabel("learning")).toBe("Learning");
    expect(statusLabel("reviewing")).toBe("Memorized");
    expect(statusLabel("mastered")).toBe("Mastered");
  });
});

describe("memorizeTitleLabel", () => {
  it("names the target", () => {
    expect(memorizeTitleLabel("Psalm 1")).toBe("Memorize Psalm 1");
  });
});

describe("refresher copy", () => {
  it("keeps the check-answer hint plain", () => {
    expect(ENTER_TO_CHECK_HINT).toBe(
      "Enter to check · Shift+Enter for a new line",
    );
  });
});

describe("start over copy", () => {
  it("names the verse in the confirm title", () => {
    expect(startOverTitle("Romans 8:28")).toBe("Start Romans 8:28 over?");
  });

  it("lists shaky verses and caps the list", () => {
    expect(shakyVersesOption("3, 5")).toBe("Just the shaky verses · 3, 5");
    expect(formatShakyVerseList(["3", "5", "7", "9", "11"])).toBe(
      "3, 5, 7, 9 +1 more",
    );
  });
});
