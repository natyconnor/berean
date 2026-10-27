import { describe, expect, it } from "vitest";

import { EASE_START, startOverSchedule } from "./memory-scheduler";
import {
  snapshotSchedule,
  startOverPassagePieces,
  startOverPassageSession,
} from "./memory-start-over";
import type { PassagePiece } from "./passage-pieces";

const NOW = 1_700_000_000_000;

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
): PassagePiece {
  return {
    index,
    book: "Psalm",
    chapter: 1,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment,
    learnStage: 3,
    stageReps: 2,
    dueAt: NOW,
  };
}

describe("startOverPassagePieces", () => {
  it("resets only the chosen pieces to unreached Read", () => {
    const pieces = [piece(0, "solid"), piece(1, "solid"), piece(2, "attached")];
    const next = startOverPassagePieces(pieces, new Set([1, 2]));
    expect(next[0]).toEqual(pieces[0]);
    expect(next[1]).toMatchObject({
      attachment: "unreached",
      learnStage: 0,
      stageReps: 0,
    });
    expect(next[1]?.dueAt).toBeUndefined();
    expect(next[2]?.attachment).toBe("unreached");
  });
});

describe("startOverPassageSession", () => {
  const current = {
    lastSessionAt: NOW,
    addsOnDay: 1,
    addDayKey: 42,
  };

  it("clears practice and today's introduce budget on a whole-passage reset", () => {
    const pieces = [piece(0, "solid"), piece(1, "learning")];
    expect(startOverPassageSession(pieces, new Set([0, 1]), current)).toEqual({
      addsOnDay: 0,
    });
  });

  it("keeps practice and introduce budget when only some pieces reset", () => {
    const pieces = [piece(0, "solid"), piece(1, "learning")];
    expect(startOverPassageSession(pieces, new Set([1]), current)).toEqual(
      current,
    );
  });
});

describe("snapshotSchedule", () => {
  it("keeps the fields undo needs and nothing else", () => {
    const prior = {
      status: "reviewing" as const,
      learnStage: 3,
      stageReps: 0,
      ease: 2.1,
      intervalDays: 24,
      dueAt: NOW - 1000,
      consecutiveCorrect: 5,
      lapses: 1,
      earlyReviewApplied: false,
      lastReviewedAt: NOW - 2000,
    };
    expect(snapshotSchedule(prior)).toEqual(prior);
    expect(startOverSchedule(NOW).ease).toBe(EASE_START);
  });
});
