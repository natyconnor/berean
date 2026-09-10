import { describe, expect, it } from "vitest";

import {
  EASE_START,
  MAX_LEARN_STAGE,
  type MemorySchedule,
} from "./memory-scheduler";
import type { HeartedMemorySpan } from "./passage-frontier";
import type { PassagePieceBase } from "./passage-pieces";
import { assertFrozenPieceBases, planStart } from "./passage-start";
import type { VerseScope } from "./verse-scope-match";

const NOW = 1_700_000_000_000;

const PSALM_1: VerseScope = {
  books: ["Psalms"],
  chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 1 }],
};

const JOHN_3: VerseScope = {
  books: ["John"],
  chapterRanges: [{ book: "John", startChapter: 3, endChapter: 3 }],
};

function psalmPiece(
  index: number,
  startVerse: number,
  endVerse: number,
): PassagePieceBase {
  return {
    index,
    book: "Psalms",
    chapter: 1,
    startVerse,
    endVerse,
    sectionIndex: 0,
  };
}

const PSALM_PIECES: PassagePieceBase[] = [
  psalmPiece(0, 1, 2),
  psalmPiece(1, 3, 4),
  psalmPiece(2, 5, 6),
];

function psalmHeart(
  startVerse: number,
  endVerse: number,
  extra?: Partial<HeartedMemorySpan>,
): HeartedMemorySpan {
  return {
    book: "Psalms",
    chapter: 1,
    startVerse,
    endVerse,
    status: "new",
    ...extra,
  };
}

function reviewingSchedule(extra?: Partial<MemorySchedule>): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 5,
    dueAt: NOW + 3 * 86_400_000,
    consecutiveCorrect: 3,
    lapses: 0,
    earlyReviewApplied: true,
    ...extra,
  };
}

describe("assertFrozenPieceBases", () => {
  it("rejects an empty list and out-of-order indexes", () => {
    expect(() => assertFrozenPieceBases([])).toThrow(
      "Passage pieces are required",
    );
    expect(() => assertFrozenPieceBases([psalmPiece(1, 1, 2)])).toThrow(
      "Passage pieces must be frozen in Scripture order",
    );
  });
});

describe("planStart", () => {
  it("unhearts a 1:1 auto-heart bijection covering the scope", () => {
    const hearts = PSALM_PIECES.map((piece) =>
      psalmHeart(piece.startVerse, piece.endVerse),
    );

    const plan = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });

    expect(plan.unheartSpans).toEqual(
      hearts.map((heart) => ({
        book: heart.book,
        chapter: heart.chapter,
        startVerse: heart.startVerse,
        endVerse: heart.endVerse,
      })),
    );
    expect(plan.unheartedCount).toBe(3);
    expect(plan.keptHeartCount).toBe(0);
    expect(plan.status).toBe("building");
    expect(plan.pieces.every((piece) => piece.attachment === "unreached")).toBe(
      true,
    );
  });

  it("keeps John 3:16 beside a 16–17 canonical piece", () => {
    const pieces: PassagePieceBase[] = [
      {
        index: 0,
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 17,
        sectionIndex: 0,
        sectionLabel: "Chapter 3",
      },
    ];
    const hearts: HeartedMemorySpan[] = [
      {
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
        status: "learning",
        learnStage: 1,
        stageReps: 2,
      },
    ];

    const plan = planStart({
      pieces,
      hearts,
      scope: JOHN_3,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });

    expect(plan.unheartSpans).toEqual([]);
    expect(plan.unheartedCount).toBe(0);
    expect(plan.keptHeartCount).toBe(1);
    expect(plan.pieces[0]?.attachment).toBe("unreached");
    expect(plan.pieces[0]?.sectionLabel).toBe("Chapter 3");
    expect(plan.status).toBe("building");
  });

  it("infers solid attachment from review-phase hearts", () => {
    const hearts: HeartedMemorySpan[] = [
      psalmHeart(1, 2, { status: "reviewing", learnStage: MAX_LEARN_STAGE }),
      psalmHeart(5, 6, { status: "mastered", learnStage: MAX_LEARN_STAGE }),
    ];

    const plan = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });

    expect(plan.pieces[0]?.attachment).toBe("solid");
    expect(plan.pieces[1]?.attachment).toBe("unreached");
    expect(plan.pieces[2]?.attachment).toBe("solid");
    expect(plan.status).toBe("building");
    expect(plan.unheartedCount).toBe(0);
    expect(plan.keptHeartCount).toBe(2);
  });

  it("opens reviewing from canonical review-heart schedules when every piece is solid", () => {
    const hearts = PSALM_PIECES.map((piece) =>
      psalmHeart(piece.startVerse, piece.endVerse, {
        status: "reviewing",
        learnStage: MAX_LEARN_STAGE,
      }),
    );
    const tight = reviewingSchedule({
      intervalDays: 2,
      ease: 2.5,
      consecutiveCorrect: 1,
    });
    const loose = reviewingSchedule({
      intervalDays: 12,
      ease: 1.4,
      lapses: 4,
      status: "mastered",
    });

    const plan = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: true,
      memberSchedules: [loose, tight],
      now: NOW,
    });

    expect(plan.status).toBe("reviewing");
    expect(plan.schedule.status).toBe("reviewing");
    expect(plan.schedule.intervalDays).toBe(2);
    expect(plan.schedule.ease).toBe(2.5);
    expect(plan.schedule.dueAt).toBe(NOW);
    expect(plan.pieces.every((piece) => piece.attachment === "solid")).toBe(
      true,
    );
  });

  it("prefers mastered only when the canonical lead is mastered", () => {
    const hearts = PSALM_PIECES.map((piece) =>
      psalmHeart(piece.startVerse, piece.endVerse, {
        status: "mastered",
        learnStage: MAX_LEARN_STAGE,
      }),
    );
    const mastered = reviewingSchedule({
      status: "mastered",
      intervalDays: 40,
      ease: 2.4,
    });

    const plan = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [mastered, mastered],
      now: NOW,
    });

    expect(plan.status).toBe("mastered");
    expect(plan.schedule.status).toBe("mastered");
    expect(plan.schedule.intervalDays).toBe(40);
  });

  it("documents that a second start must be idempotent at the mutation layer", () => {
    const hearts = PSALM_PIECES.map((piece) =>
      psalmHeart(piece.startVerse, piece.endVerse),
    );
    const first = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });
    expect(first.unheartedCount).toBe(3);

    // After unheart, replanning sees no auto-heart bijection. The mutation
    // must return the stored row instead of calling planStart again.
    const replanned = planStart({
      pieces: PSALM_PIECES,
      hearts: [],
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });
    expect(replanned.unheartedCount).toBe(0);
    expect(replanned.keptHeartCount).toBe(0);
    expect(replanned).not.toEqual(first);
  });
});
