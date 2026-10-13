import { describe, expect, it } from "vitest";

import { passageHeartSpans, type VerseSpan } from "./hearted-verse-coverage";
import {
  carriedOverVerses,
  passageCoverage,
  passageRelation,
  sameSpanSet,
  spansOverlapAny,
  uniqueSpans,
  type VerseProgressSpan,
} from "./memorize-status";
import { memorizeTargetSpans, resolveMemorizeTarget } from "./memorize-target";

function span(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): VerseSpan {
  return { book, chapter, startVerse, endVerse };
}

const matthew5to7 = [
  span("Matthew", 5, 1, 48),
  span("Matthew", 6, 1, 34),
  span("Matthew", 7, 1, 29),
];

describe("passageCoverage", () => {
  it("is equal when the target covers the same chapters", () => {
    expect(passageCoverage(matthew5to7, matthew5to7)).toBe("equal");
    expect(
      passageCoverage([span("Psalms", 1, 1, 6)], [span("Psalms", 1, 1, 6)]),
    ).toBe("equal");
  });

  it("contains a verse or a smaller part of the passage", () => {
    expect(passageCoverage([span("Matthew", 6, 9, 13)], matthew5to7)).toBe(
      "contains",
    );
    expect(passageCoverage([matthew5to7[0]], matthew5to7)).toBe("contains");
  });

  it("is null when any of the target is outside the passage", () => {
    expect(
      passageCoverage(
        [span("Matthew", 6, 9), span("Matthew", 8, 1)],
        matthew5to7,
      ),
    ).toBeNull();
    expect(
      passageCoverage([span("Psalms", 1, 1, 6)], [span("Psalms", 1, 1, 5)]),
    ).toBeNull();
    expect(passageCoverage([], matthew5to7)).toBeNull();
    expect(passageCoverage(matthew5to7, [])).toBeNull();
  });
});

describe("passageCoverage with partial-chapter passages", () => {
  // What `loadMemorizeStatus` compares: the target's spans against the heart
  // spans of an active passage's pieces.
  const target = (spans: VerseSpan[]) =>
    memorizeTargetSpans(resolveMemorizeTarget({ kind: "spans", spans }));
  const passage = (pieces: VerseSpan[]) => passageHeartSpans(pieces);
  const romans8 = passage([
    span("Romans", 8, 1, 4),
    span("Romans", 8, 5, 27),
    span("Romans", 8, 28, 39),
  ]);
  const romans8_28_39 = passage([
    span("Romans", 8, 28, 30),
    span("Romans", 8, 31, 39),
  ]);

  it("is part of a whole-chapter passage that contains the range", () => {
    expect(passageCoverage(target([span("Romans", 8, 28, 39)]), romans8)).toBe(
      "contains",
    );
  });

  it("is part of a partial passage that contains it", () => {
    expect(
      passageCoverage(target([span("Romans", 8, 28)]), romans8_28_39),
    ).toBe("contains");
    expect(
      passageCoverage(
        target([span("Philippians", 2, 5, 11)]),
        passage([span("Philippians", 2, 1, 4), span("Philippians", 2, 5, 11)]),
      ),
    ).toBe("contains");
  });

  it("is the same passage when the verses match, across chapters too", () => {
    expect(
      passageCoverage(target([span("Romans", 8, 28, 39)]), romans8_28_39),
    ).toBe("equal");
    expect(
      passageCoverage(
        target([span("Romans", 7, 24, 25), span("Romans", 8, 1, 2)]),
        passage([span("Romans", 7, 24, 25), span("Romans", 8, 1, 2)]),
      ),
    ).toBe("equal");
  });

  it("is unrelated when the target reaches outside the passage", () => {
    expect(
      passageCoverage(target([span("Romans", 8, 1, 39)]), romans8_28_39),
    ).toBeNull();
    expect(
      passageCoverage(
        target([span("Philippians", 2, 1, 11)]),
        passage([span("Philippians", 2, 12, 18)]),
      ),
    ).toBeNull();
  });
});

describe("passageRelation", () => {
  const target = (spans: VerseSpan[]) =>
    memorizeTargetSpans(resolveMemorizeTarget({ kind: "spans", spans }));
  const romans8_28_39 = passageHeartSpans([
    span("Romans", 8, 28, 30),
    span("Romans", 8, 31, 39),
  ]);
  const philippians2_5_11 = passageHeartSpans([
    span("Philippians", 2, 5, 8),
    span("Philippians", 2, 9, 11),
  ]);

  it("overlaps when the target contains the passage", () => {
    const romans8 = memorizeTargetSpans(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Romans",
        startChapter: 8,
        endChapter: 8,
      }),
    );
    expect(passageRelation(romans8, romans8_28_39)).toBe("overlaps");
  });

  it("overlaps when the target crosses an edge of the passage", () => {
    expect(
      passageRelation(
        target([span("Philippians", 2, 1, 8)]),
        philippians2_5_11,
      ),
    ).toBe("overlaps");
  });

  it("is part of a passage that holds the whole target", () => {
    expect(
      passageRelation(
        target([span("Philippians", 2, 6, 9)]),
        philippians2_5_11,
      ),
    ).toBe("contains");
    expect(
      passageRelation(target([span("Romans", 8, 28, 39)]), romans8_28_39),
    ).toBe("equal");
  });

  it("is unrelated when no verse is shared", () => {
    expect(
      passageRelation(
        target([span("Philippians", 2, 1, 4)]),
        philippians2_5_11,
      ),
    ).toBeNull();
    expect(
      passageRelation(target([span("Romans", 7, 1, 25)]), romans8_28_39),
    ).toBeNull();
  });
});

describe("spansOverlapAny", () => {
  it("needs a shared verse in the same chapter", () => {
    expect(
      spansOverlapAny([span("John", 3, 16, 18)], [span("John", 3, 18, 21)]),
    ).toBe(true);
    expect(
      spansOverlapAny([span("John", 3, 16, 17)], [span("John", 3, 18, 21)]),
    ).toBe(false);
    expect(spansOverlapAny([span("John", 3, 16)], [span("John", 4, 16)])).toBe(
      false,
    );
  });
});

describe("uniqueSpans", () => {
  it("drops exact repeats and keeps first-seen order", () => {
    expect(
      uniqueSpans([
        span("John", 3, 16),
        span("Romans", 8, 28),
        span("John", 3, 16),
        span("John", 3, 16, 17),
      ]),
    ).toEqual([
      span("John", 3, 16),
      span("Romans", 8, 28),
      span("John", 3, 16, 17),
    ]);
  });
});

describe("carriedOverVerses", () => {
  const psalm1 = [span("Psalms", 1, 1, 6)];
  const verse = (
    startVerse: number,
    status: VerseProgressSpan["status"],
    learnStage = 0,
    stageReps = 0,
  ): VerseProgressSpan => ({
    ...span("Psalms", 1, startVerse),
    status,
    learnStage,
    stageReps,
  });

  it("lists memorized and started verses inside the target, in order", () => {
    expect(
      carriedOverVerses(psalm1, [
        verse(5, "learning", 1, 0),
        verse(3, "reviewing", 3),
        verse(2, "mastered", 3),
        verse(4, "learning", 0, 2),
      ]),
    ).toEqual([
      { ...span("Psalms", 1, 2), memorized: true },
      { ...span("Psalms", 1, 3), memorized: true },
      { ...span("Psalms", 1, 4), memorized: false },
      { ...span("Psalms", 1, 5), memorized: false },
    ]);
  });

  it("skips Up next and never-practiced verses", () => {
    expect(
      carriedOverVerses(psalm1, [verse(1, "new"), verse(2, "learning")]),
    ).toEqual([]);
  });

  it("skips verses that reach outside the target", () => {
    expect(
      carriedOverVerses(
        [span("Psalms", 1, 1, 3)],
        [
          {
            ...span("Psalms", 1, 3, 4),
            status: "reviewing",
            learnStage: 3,
            stageReps: 0,
          },
          {
            ...span("Psalms", 2, 1),
            status: "reviewing",
            learnStage: 3,
            stageReps: 0,
          },
        ],
      ),
    ).toEqual([]);
  });

  it("drops exact repeats", () => {
    expect(
      carriedOverVerses(psalm1, [verse(3, "reviewing"), verse(3, "reviewing")]),
    ).toHaveLength(1);
  });
});

describe("sameSpanSet", () => {
  it("ignores order and repeats", () => {
    expect(
      sameSpanSet(
        [span("Romans", 8, 28), span("John", 3, 16)],
        [span("John", 3, 16), span("Romans", 8, 28), span("John", 3, 16)],
      ),
    ).toBe(true);
  });

  it("is false when either side has a span the other lacks", () => {
    expect(
      sameSpanSet([span("Romans", 8, 28)], [span("Romans", 8, 28, 29)]),
    ).toBe(false);
    expect(
      sameSpanSet(
        [span("Romans", 8, 28)],
        [span("Romans", 8, 28), span("John", 3, 16)],
      ),
    ).toBe(false);
  });
});
