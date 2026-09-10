import { describe, expect, it } from "vitest";

import { DAY_MS, MAX_LEARN_STAGE } from "./memory-scheduler";
import {
  countDuePassageLearning,
  countDuePassageReviews,
  isPassageDueForLearning,
  isPassageDueForReview,
  passageLearningDueAt,
  passageRopeCounts,
} from "./passage-due";
import { PASSAGE_MAX_ADDS_PER_DAY } from "./passage-frontier";
import type { PassagePiece } from "./passage-pieces";

const NOW = DAY_MS * 10;
const TZ = 0;

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  extra?: Partial<PassagePiece>,
): PassagePiece {
  return {
    index,
    book: "John",
    chapter: 3,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment,
    learnStage: 0,
    stageReps: 0,
    ...extra,
  };
}

describe("isPassageDueForReview", () => {
  it("counts a reviewing passage as one due card when dueAt has arrived", () => {
    expect(
      isPassageDueForReview({ status: "reviewing", dueAt: NOW - 1 }, NOW),
    ).toBe(true);
    expect(isPassageDueForReview({ status: "mastered", dueAt: NOW }, NOW)).toBe(
      true,
    );
  });

  it("does not count building passages or future reviews", () => {
    expect(
      isPassageDueForReview({ status: "building", dueAt: NOW - 1 }, NOW),
    ).toBe(false);
    expect(
      isPassageDueForReview({ status: "reviewing", dueAt: NOW + DAY_MS }, NOW),
    ).toBe(false);
  });
});

describe("isPassageDueForLearning", () => {
  it("counts a building passage with remaining introduces and an unreached piece", () => {
    expect(
      isPassageDueForLearning(
        {
          status: "building",
          dueAt: NOW,
          addsOnDay: 0,
          addDayKey: undefined,
          pieces: [piece(0, "unreached")],
        },
        NOW,
        TZ,
      ),
    ).toBe(true);
  });

  it("counts an introduced piece whose dueAt is missing or has arrived", () => {
    expect(
      isPassageDueForLearning(
        {
          status: "building",
          dueAt: NOW,
          addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
          addDayKey: Math.floor(NOW / DAY_MS),
          pieces: [
            piece(0, "learning", { dueAt: undefined }),
            piece(1, "unreached"),
          ],
        },
        NOW,
        TZ,
      ),
    ).toBe(true);
    expect(
      isPassageDueForLearning(
        {
          status: "building",
          dueAt: NOW,
          addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
          addDayKey: Math.floor(NOW / DAY_MS),
          pieces: [piece(0, "attached", { dueAt: NOW, learnStage: 2 })],
        },
        NOW,
        TZ,
      ),
    ).toBe(true);
  });

  it("does not inflate learningDue when the frontier is soft-locked and introduces are spent", () => {
    expect(
      isPassageDueForLearning(
        {
          status: "building",
          dueAt: NOW,
          addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
          addDayKey: Math.floor(NOW / DAY_MS),
          pieces: [
            piece(0, "attached", { dueAt: NOW + DAY_MS, learnStage: 2 }),
            piece(1, "solid", { learnStage: MAX_LEARN_STAGE }),
            piece(2, "unreached"),
          ],
        },
        NOW,
        TZ,
      ),
    ).toBe(false);
  });

  it("does not treat reviewing passages or packs without a building row as learn-due", () => {
    expect(
      isPassageDueForLearning(
        {
          status: "reviewing",
          dueAt: NOW,
          addsOnDay: 0,
          addDayKey: undefined,
          pieces: [piece(0, "solid")],
        },
        NOW,
        TZ,
      ),
    ).toBe(false);
  });
});

describe("passage due counts", () => {
  it("counts each due reviewing passage as 1 and ignores building rows", () => {
    expect(
      countDuePassageReviews(
        [
          { status: "reviewing", dueAt: NOW },
          { status: "building", dueAt: NOW },
          { status: "mastered", dueAt: NOW + 1 },
        ],
        NOW,
      ),
    ).toBe(1);
  });

  it("counts each building passage with a session today as 1", () => {
    expect(
      countDuePassageLearning(
        [
          {
            status: "building",
            dueAt: NOW,
            addsOnDay: 0,
            addDayKey: undefined,
            pieces: [piece(0, "unreached")],
          },
          {
            status: "building",
            dueAt: NOW,
            addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
            addDayKey: Math.floor(NOW / DAY_MS),
            pieces: [
              piece(0, "learning", { dueAt: NOW + DAY_MS }),
              piece(1, "unreached"),
            ],
          },
        ],
        NOW,
        TZ,
      ),
    ).toBe(1);
  });
});

describe("passageRopeCounts / passageLearningDueAt", () => {
  it("reports solid, attached-on-rope, and total pieces", () => {
    expect(
      passageRopeCounts([
        piece(0, "solid"),
        piece(1, "solid"),
        piece(2, "attached"),
        piece(3, "learning"),
        piece(4, "unreached"),
      ]),
    ).toEqual({ solidCount: 2, attachedCount: 1, pieceCount: 5 });
  });

  it("uses the soonest introduced dueAt for the learning card", () => {
    expect(
      passageLearningDueAt(
        [
          piece(0, "solid"),
          piece(1, "attached", { dueAt: NOW + 50 }),
          piece(2, "learning", { dueAt: NOW + 10 }),
          piece(3, "unreached"),
        ],
        NOW,
      ),
    ).toBe(NOW + 10);
  });
});
