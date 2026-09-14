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
  it("detects Guided/Challenge pieces in the repair window", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "attached", { learnStage: 1 }),
    ];
    expect(repairWindowShowsStageHints(pieces, [0, 1])).toBe(true);
    expect(repairWindowShowsStageHints(pieces, [0])).toBe(false);
  });

  it("labels a bridge-only cue when the window already has letter hints", () => {
    const pieces = [
      piece(0, "attached", { learnStage: 1 }),
      piece(1, "attached", { learnStage: 1 }),
    ];
    const state = {
      phase: "stall-repair",
      pieces,
      stallIndex: 1,
      rehearsalRopeIndexes: [0, 1],
      addsOnDay: 0,
      addDayKey: 0,
      now: 0,
      tzOffsetMinutes: 0,
    } as PassageSessionState;
    const cue = computeStallCue(state, [
      "Blessed is the man who walks not",
      "but his delight is in the law",
    ]);
    expect(cue).not.toBeNull();
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toMatch(/walks not$/);
    expect(cue?.text).not.toMatch(/_/);
  });
});
