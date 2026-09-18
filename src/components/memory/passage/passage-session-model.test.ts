import { describe, expect, it } from "vitest";

import type { PassagePiece } from "@/lib/passage-pieces";

import {
  computeStallCue,
  repairWindowShowsStageHints,
  stallRepairCue,
} from "./passage-session-model";
import type { PassageSessionState } from "@/lib/passage-session";

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  overrides: Partial<PassagePiece> = {},
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 1,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment,
    learnStage: 1,
    stageReps: 0,
    dueAt: 0,
    ...overrides,
  };
}

describe("stallRepairCue", () => {
  it("includes first-letter recovery when the main panel has no stage hints", () => {
    const cue = stallRepairCue(
      "end of previous verse here",
      "Blessed is the man",
    );
    expect(cue).toContain("previous verse here");
    expect(cue).toMatch(/B/);
    expect(cue).not.toContain("Blessed is the man");
  });

  it("keeps only the clear bridge when letter hints are already on screen", () => {
    const cue = stallRepairCue(
      "end of previous verse here",
      "Blessed is the man",
      {
        includeStalledLetters: false,
      },
    );
    expect(cue).toBe("end of previous verse here");
  });
});

describe("repairWindowShowsStageHints / computeStallCue", () => {
  function stallState(
    pieces: PassagePiece[],
    stallIndex: number,
    rehearsalRopeIndexes: number[],
  ): PassageSessionState {
    return {
      phase: "stall-repair",
      pieces,
      stallIndex,
      rehearsalRopeIndexes,
      addsOnDay: 0,
      addDayKey: 0,
      now: 0,
      tzOffsetMinutes: 0,
    };
  }

  it("detects Guided/Challenge pieces in the repair window", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "attached", { learnStage: 1 }),
    ];
    expect(repairWindowShowsStageHints(pieces, [0, 1])).toBe(true);
    expect(repairWindowShowsStageHints(pieces, [0])).toBe(false);
  });

  it("labels a bridge-only cue from the verse before the repair window", () => {
    const pieces = [
      piece(0, "attached", { learnStage: 1 }),
      piece(1, "attached", { learnStage: 1 }),
      piece(2, "attached", { learnStage: 1 }),
    ];
    // Stall on verse 3 → repair retries from verse 2. Cue must be the ending
    // of verse 1, not the ending of the verse the learner is about to type.
    const cue = computeStallCue(stallState(pieces, 2, [0, 1, 2]), [
      "I have no good apart from you.",
      "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
      "The sorrows of those who run after another god shall multiply.",
    ]);
    expect(cue).not.toBeNull();
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toMatch(/apart from you\.$/);
    expect(cue?.text).not.toMatch(/delight/);
    expect(cue?.text).not.toMatch(/_/);
  });

  it("omits a pick-up phrase when repair starts at the first learned verse", () => {
    const pieces = [
      piece(0, "attached", { learnStage: 1 }),
      piece(1, "attached", { learnStage: 1 }),
    ];
    const cue = computeStallCue(stallState(pieces, 1, [0, 1]), [
      "Blessed is the man who walks not",
      "but his delight is in the law",
    ]);
    expect(cue).toBeNull();
  });

  it("walks back across an unreached gap for the pick-up phrase", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "unreached"),
      piece(2, "attached", { learnStage: 1 }),
      piece(3, "attached", { learnStage: 1 }),
    ];
    const cue = computeStallCue(stallState(pieces, 2, [0, 2, 3]), [
      "end of the earlier verse here",
      "unreached verse should not cue",
      "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
      "The sorrows of those who run after another god shall multiply.",
    ]);
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toBe("end of the earlier verse here");
    expect(cue?.text).not.toContain("unreached");
    expect(cue?.text).not.toContain("delight");
  });

  it("cues from the verse before a mid-passage repair window", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "solid", { learnStage: 3 }),
      piece(2, "attached", { learnStage: 1 }),
      piece(3, "attached", { learnStage: 1 }),
    ];
    const cue = computeStallCue(stallState(pieces, 1, [2, 3]), [
      "Preserve me, O God, for in you I take refuge.",
      "I say to the LORD, You are my Lord; I have no good apart from you.",
      "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
      "The sorrows of those who run after another god shall multiply.",
    ]);
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toMatch(/apart from you\.$/);
    expect(cue?.text).not.toMatch(/delight/);
  });
});
