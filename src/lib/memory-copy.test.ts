import { describe, expect, it } from "vitest";

import {
  startOverPassagePatch,
  startOverVersePatch,
} from "./memory-start-over";
import {
  NEED_A_REFRESHER_LABEL,
  NEED_A_REFRESHER_TOOLTIP,
  NOW_TRY_WITHOUT_HINTS,
  PRACTICE_ONLY_CLOSING,
  PRACTICE_PASS_EMOJI,
  PRACTICE_PASS_LINE,
  REFRESH_SAVE_ERROR,
  TRY_ANOTHER_REFRESHER_LABEL,
  canStartOver,
  canStartOverPassage,
  hasLearningProgress,
  memorizeTitleLabel,
  passageStepLine,
  refresherHeader,
  START_OVER_CONFIRM_BODY,
  startOverPassageBody,
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

describe("hasLearningProgress and canStartOver", () => {
  it("hides Start over on New or Read with nothing done", () => {
    const fresh = { status: "new" as const, learnStage: 0 };
    expect(hasLearningProgress(fresh)).toBe(false);
    expect(canStartOver(fresh)).toBe(false);
    expect(
      canStartOver({ status: "learning", learnStage: 0, stageReps: 0 }),
    ).toBe(false);
  });

  it("shows Start over after a step, a banked rep, or a logged try", () => {
    expect(canStartOver({ status: "learning", learnStage: 1 })).toBe(true);
    expect(
      canStartOver({ status: "learning", learnStage: 0, stageReps: 1 }),
    ).toBe(true);
    expect(
      canStartOver({
        status: "learning",
        learnStage: 0,
        lastReviewedAt: 1,
      }),
    ).toBe(true);
  });

  it("shows Start over for Memorized and Mastered verses", () => {
    expect(canStartOver({ status: "reviewing", learnStage: 3 })).toBe(true);
    expect(canStartOver({ status: "mastered", learnStage: 3 })).toBe(true);
  });

  it("hides Start over again right after a reset", () => {
    const reset = startOverVersePatch(1_700_000_000_000);
    expect(hasLearningProgress(reset)).toBe(false);
    expect(canStartOver(reset)).toBe(false);
  });
});

describe("startOver copy", () => {
  it("titles the confirm with the verse reference", () => {
    expect(startOverTitle("John 3:16")).toBe("Start John 3:16 over?");
  });

  it("uses the follow-up confirm line word for word", () => {
    expect(START_OVER_CONFIRM_BODY).toBe(
      "You'll learn it again from the start, and this page will count from today. Your past tries aren't deleted, and your streak and overall stats stay as they are. This can't be undone.",
    );
    expect(startOverPassageBody(14)).toBe(
      "You'll learn all 14 verses again from the start, and this page will count from today. Your past tries aren't deleted, and your streak and overall stats stay as they are. This can't be undone.",
    );
  });
});

describe("canStartOverPassage", () => {
  const fresh = {
    attachment: "unreached" as const,
    learnStage: 0,
    stageReps: 0,
  };

  it("hides Start over when nothing is reached", () => {
    expect(canStartOverPassage([fresh])).toBe(false);
    expect(
      canStartOverPassage([
        { attachment: "learning", learnStage: 0, stageReps: 0 },
      ]),
    ).toBe(false);
  });

  it("shows Start over once a piece is attached, solid, or in progress", () => {
    expect(canStartOverPassage([{ ...fresh, attachment: "attached" }])).toBe(
      true,
    );
    expect(canStartOverPassage([{ ...fresh, attachment: "solid" }])).toBe(true);
    expect(canStartOverPassage([{ ...fresh, learnStage: 1 }])).toBe(true);
    expect(canStartOverPassage([{ ...fresh, stageReps: 1 }])).toBe(true);
  });

  it("hides Start over again right after a reset", () => {
    const reset = startOverPassagePatch(
      [
        {
          index: 0,
          book: "Psalms",
          chapter: 23,
          startVerse: 1,
          endVerse: 6,
          sectionIndex: 0,
          attachment: "solid",
          learnStage: 3,
          stageReps: 2,
        },
      ],
      1_700_000_000_000,
    );
    expect(canStartOverPassage(reset.pieces)).toBe(false);
  });
});

describe("refresher copy", () => {
  it("names the quiet link and the two step headers", () => {
    expect(NEED_A_REFRESHER_LABEL).toBe("Need a refresher?");
    expect(TRY_ANOTHER_REFRESHER_LABEL).toBe("Try another refresher");
    expect(NEED_A_REFRESHER_TOOLTIP).toBe(
      "Do a refresher on this verse for some more practice.",
    );
    expect(PRACTICE_ONLY_CLOSING).toBe(
      "This was just practice, so your progress didn't change.",
    );
    expect(PRACTICE_PASS_LINE).toBe(
      "Good work getting back on track. Next time see if you can get it on the first try.",
    );
    expect(PRACTICE_PASS_EMOJI).toBe("👍");
    expect(NOW_TRY_WITHOUT_HINTS).toBe("Now try it without the hints.");
    expect(REFRESH_SAVE_ERROR).toBe(
      "Couldn't save your result. Please try again.",
    );
    expect(refresherHeader(1)).toBe("Refresh · First letters · 1 of 2");
    expect(refresherHeader(2)).toBe("Refresh · From memory · 2 of 2");
  });

  it("counts 3 steps once the every-word First letters step appears", () => {
    expect(refresherHeader(1, 3)).toBe("Refresh · First letters · 1 of 3");
    expect(refresherHeader(2, 3)).toBe("Refresh · First letters · 2 of 3");
    expect(refresherHeader(3, 3)).toBe("Refresh · From memory · 3 of 3");
    for (const [step, total] of [
      [1, 2],
      [2, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ] as const) {
      expect(refresherHeader(step, total)).not.toMatch(/light|full/i);
    }
  });
});
