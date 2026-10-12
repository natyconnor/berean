import { describe, expect, it } from "vitest";

import {
  EASE_START,
  MAX_LEARN_STAGE,
  type MemorySchedule,
} from "./memory-scheduler";
import type { HeartedMemorySpan } from "./passage-frontier";
import type { PassagePieceBase } from "./passage-pieces";
import {
  absorbedVerseItems,
  assertFrozenPieceBases,
  assertPiecesMatchScope,
  planStart,
} from "./passage-start";
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

describe("assertPiecesMatchScope", () => {
  it("rejects pieces outside the pack scope", () => {
    expect(() =>
      assertPiecesMatchScope(
        [
          {
            index: 0,
            book: "John",
            chapter: 3,
            startVerse: 1,
            endVerse: 2,
            sectionIndex: 0,
          },
        ],
        PSALM_1,
      ),
    ).toThrow(/within the pack scope/);
  });

  it("rejects overlapping verse spans", () => {
    expect(() =>
      assertPiecesMatchScope(
        [psalmPiece(0, 1, 3), psalmPiece(1, 3, 4)],
        PSALM_1,
      ),
    ).toThrow(/must not overlap/);
  });
});

describe("planStart", () => {
  it("freezes Up-next members as unreached and plans no heart changes", () => {
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

    expect(plan).not.toHaveProperty("unheartSpans");
    expect(plan).not.toHaveProperty("unheartedCount");
    expect(plan).not.toHaveProperty("keptHeartCount");
    expect(plan.status).toBe("building");
    expect(plan.pieces.every((piece) => piece.attachment === "unreached")).toBe(
      true,
    );
  });

  it("freezes enrolled-but-unread members as unreached", () => {
    const hearts = PSALM_PIECES.map((piece) =>
      psalmHeart(piece.startVerse, piece.endVerse, {
        status: "learning",
        learnStage: 0,
        stageReps: 0,
      }),
    );

    const plan = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });

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
      psalmHeart(piece.startVerse, piece.endVerse, {
        status: "reviewing",
        learnStage: MAX_LEARN_STAGE,
      }),
    );
    const first = planStart({
      pieces: PSALM_PIECES,
      hearts,
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });
    expect(first.pieces.every((piece) => piece.attachment === "solid")).toBe(
      true,
    );

    // After start absorbs the members, replanning sees none of their
    // progress. The mutation must return the stored row instead of calling
    // planStart again.
    const replanned = planStart({
      pieces: PSALM_PIECES,
      hearts: [],
      scope: PSALM_1,
      unifiedEnabled: false,
      memberSchedules: [],
      now: NOW,
    });
    expect(replanned).not.toEqual(first);
  });
});

describe("absorbedVerseItems", () => {
  function item(
    startVerse: number,
    endVerse: number,
    extra?: { chapter?: number; book?: string; inCustomPack?: boolean },
  ) {
    return {
      id: `${extra?.book ?? "Psalms"} ${extra?.chapter ?? 1}:${startVerse}-${endVerse}`,
      book: extra?.book ?? "Psalms",
      chapter: extra?.chapter ?? 1,
      startVerse,
      endVerse,
      inCustomPack: extra?.inCustomPack ?? false,
    };
  }

  it("picks standalone items fully inside the passage", () => {
    const inside = [item(1, 1), item(3, 4), item(1, 6)];
    expect(absorbedVerseItems(inside, PSALM_PIECES)).toEqual(inside);
  });

  it("keeps items that a custom pack holds separately", () => {
    const packed = item(2, 2, { inCustomPack: true });
    const standalone = item(5, 5);
    expect(absorbedVerseItems([packed, standalone], PSALM_PIECES)).toEqual([
      standalone,
    ]);
  });

  it("keeps items that reach outside the passage range or chapter", () => {
    const pieces: PassagePieceBase[] = [
      psalmPiece(0, 3, 4),
      psalmPiece(1, 5, 6),
    ];
    const items = [
      item(2, 4),
      item(5, 7),
      item(3, 3, { chapter: 2 }),
      item(3, 3, { book: "John" }),
      item(4, 5),
    ];
    expect(absorbedVerseItems(items, pieces).map((i) => i.id)).toEqual([
      "Psalms 1:4-5",
    ]);
  });

  it("covers each chapter of a multi-chapter passage separately", () => {
    const pieces: PassagePieceBase[] = [
      psalmPiece(0, 1, 6),
      { ...psalmPiece(1, 1, 3), chapter: 2 },
    ];
    const items = [
      item(6, 6),
      item(2, 3, { chapter: 2 }),
      item(4, 4, { chapter: 2 }),
    ];
    expect(absorbedVerseItems(items, pieces).map((i) => i.id)).toEqual([
      "Psalms 1:6-6",
      "Psalms 2:2-3",
    ]);
  });
});
