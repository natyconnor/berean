import { describe, expect, it } from "vitest";

import {
  coveringSpans,
  exactSpanMatch,
  heartedRunsForChapter,
  overlappingSpans,
  passageHeartSpans,
  spanContains,
  spanCoveredBy,
  spanCoversVerse,
  spansLosingCoverage,
  spansOverlap,
  type VerseSpan,
} from "./hearted-verse-coverage";

function john(startVerse: number, endVerse = startVerse): VerseSpan {
  return { book: "John", chapter: 3, startVerse, endVerse };
}

const JOHN_3_16_18 = john(16, 18);
const JOHN_3_VERSE_COUNT = 36;

describe("spanCoversVerse / coveringSpans", () => {
  it("covers 16, 17, 18 of John 3:16–18, not 15 or 19", () => {
    expect(spanCoversVerse(JOHN_3_16_18, 16)).toBe(true);
    expect(spanCoversVerse(JOHN_3_16_18, 17)).toBe(true);
    expect(spanCoversVerse(JOHN_3_16_18, 18)).toBe(true);
    expect(spanCoversVerse(JOHN_3_16_18, 15)).toBe(false);
    expect(spanCoversVerse(JOHN_3_16_18, 19)).toBe(false);

    const spans = [JOHN_3_16_18];
    expect(coveringSpans(spans, "John", 3, 16)).toEqual([JOHN_3_16_18]);
    expect(coveringSpans(spans, "John", 3, 17)).toEqual([JOHN_3_16_18]);
    expect(coveringSpans(spans, "John", 3, 18)).toEqual([JOHN_3_16_18]);
    expect(coveringSpans(spans, "John", 3, 15)).toEqual([]);
    expect(coveringSpans(spans, "John", 3, 19)).toEqual([]);
  });
});

describe("heartedRunsForChapter", () => {
  it("unions overlapping spans 16 and 16–18 into one run 16–18", () => {
    expect(
      heartedRunsForChapter(
        [john(16), john(16, 18)],
        "John",
        3,
        JOHN_3_VERSE_COUNT,
      ),
    ).toEqual([{ start: 16, end: 18 }]);
  });
});

describe("spansOverlap / overlappingSpans", () => {
  it("treats selection 14–17 as overlapping 16–18", () => {
    const selection = john(14, 17);
    expect(spansOverlap(selection, JOHN_3_16_18)).toBe(true);
    expect(overlappingSpans(selection, [JOHN_3_16_18])).toEqual([JOHN_3_16_18]);
  });

  it("treats selection 14–15 as not overlapping 16–18", () => {
    const selection = john(14, 15);
    expect(spansOverlap(selection, JOHN_3_16_18)).toBe(false);
    expect(overlappingSpans(selection, [JOHN_3_16_18])).toEqual([]);
  });

  it("never overlaps different books or chapters", () => {
    const otherBook: VerseSpan = {
      book: "Romans",
      chapter: 3,
      startVerse: 16,
      endVerse: 18,
    };
    const otherChapter: VerseSpan = {
      book: "John",
      chapter: 4,
      startVerse: 16,
      endVerse: 18,
    };
    expect(spansOverlap(JOHN_3_16_18, otherBook)).toBe(false);
    expect(spansOverlap(JOHN_3_16_18, otherChapter)).toBe(false);
    expect(overlappingSpans(JOHN_3_16_18, [otherBook, otherChapter])).toEqual(
      [],
    );
    expect(coveringSpans([otherBook, otherChapter], "John", 3, 16)).toEqual([]);
  });
});

describe("exactSpanMatch", () => {
  it("returns the matching 16–18 span", () => {
    const spans = [john(16), JOHN_3_16_18];
    expect(exactSpanMatch(john(16, 18), spans)).toEqual(JOHN_3_16_18);
  });
});

describe("spanContains / spanCoveredBy", () => {
  it("counts an exact heart as covering", () => {
    expect(spanContains(JOHN_3_16_18, JOHN_3_16_18)).toBe(true);
    expect(spanCoveredBy(JOHN_3_16_18, [JOHN_3_16_18])).toBe(true);
  });

  it("counts a wider heart as covering a verse inside it", () => {
    expect(spanCoveredBy(john(17), [JOHN_3_16_18])).toBe(true);
    expect(spanCoveredBy(john(16, 17), [john(1, 36)])).toBe(true);
  });

  it("does not count a narrower or straddling heart", () => {
    expect(spanCoveredBy(JOHN_3_16_18, [john(17)])).toBe(false);
    expect(spanCoveredBy(john(15, 16), [JOHN_3_16_18])).toBe(false);
    expect(spanCoveredBy(john(18, 19), [JOHN_3_16_18])).toBe(false);
  });

  it("does not combine partial hearts into coverage", () => {
    expect(spanCoveredBy(john(16, 17), [john(16), john(17)])).toBe(false);
  });

  it("never covers across books or chapters", () => {
    expect(
      spanCoveredBy(john(16), [
        { book: "John", chapter: 4, startVerse: 1, endVerse: 54 },
        { book: "Romans", chapter: 3, startVerse: 1, endVerse: 31 },
      ]),
    ).toBe(false);
  });

  it("is false with no hearts", () => {
    expect(spanCoveredBy(john(16), [])).toBe(false);
  });
});

describe("spansLosingCoverage", () => {
  const verse16 = { ...john(16), id: "16" };
  const verse17 = { ...john(17), id: "17" };
  const verse20 = { ...john(20), id: "20" };

  it("reports items only the removed heart covered", () => {
    expect(
      spansLosingCoverage([JOHN_3_16_18], [], [verse16, verse17, verse20]),
    ).toEqual([verse16, verse17]);
  });

  it("keeps items another heart still covers", () => {
    expect(
      spansLosingCoverage([JOHN_3_16_18], [john(16)], [verse16, verse17]),
    ).toEqual([verse17]);
    expect(
      spansLosingCoverage([john(16)], [JOHN_3_16_18], [verse16, verse17]),
    ).toEqual([]);
  });

  it("keeps items a passage heart covers", () => {
    expect(
      spansLosingCoverage([john(16)], [john(1, 36)], [verse16, verse20]),
    ).toEqual([]);
  });

  it("ignores items the removed heart never covered", () => {
    expect(spansLosingCoverage([john(16)], [], [verse17, verse20])).toEqual([]);
  });

  it("handles several removed hearts at once", () => {
    const john4v1 = {
      book: "John",
      chapter: 4,
      startVerse: 1,
      endVerse: 1,
      id: "4:1",
    };
    expect(
      spansLosingCoverage(
        [
          john(1, 36),
          { book: "John", chapter: 4, startVerse: 1, endVerse: 54 },
        ],
        [],
        [verse16, john4v1],
      ),
    ).toEqual([verse16, john4v1]);
  });
});

describe("passageHeartSpans", () => {
  it("collapses one chapter's pieces into a single span", () => {
    expect(
      passageHeartSpans([
        { book: "Psalms", chapter: 1, startVerse: 1, endVerse: 2 },
        { book: "Psalms", chapter: 1, startVerse: 3, endVerse: 4 },
        { book: "Psalms", chapter: 1, startVerse: 5, endVerse: 6 },
      ]),
    ).toEqual([{ book: "Psalms", chapter: 1, startVerse: 1, endVerse: 6 }]);
  });

  it("returns one span per chapter for multi-chapter passages", () => {
    expect(
      passageHeartSpans([
        { book: "Matthew", chapter: 5, startVerse: 1, endVerse: 12 },
        { book: "Matthew", chapter: 5, startVerse: 13, endVerse: 48 },
        { book: "Matthew", chapter: 6, startVerse: 1, endVerse: 34 },
        { book: "Matthew", chapter: 7, startVerse: 1, endVerse: 29 },
      ]),
    ).toEqual([
      { book: "Matthew", chapter: 5, startVerse: 1, endVerse: 48 },
      { book: "Matthew", chapter: 6, startVerse: 1, endVerse: 34 },
      { book: "Matthew", chapter: 7, startVerse: 1, endVerse: 29 },
    ]);
  });

  it("uses the lowest start and highest end even out of order", () => {
    expect(
      passageHeartSpans([
        { book: "Philippians", chapter: 2, startVerse: 5, endVerse: 8 },
        { book: "Philippians", chapter: 2, startVerse: 1, endVerse: 4 },
      ]),
    ).toEqual([
      { book: "Philippians", chapter: 2, startVerse: 1, endVerse: 8 },
    ]);
  });

  it("does not mutate the pieces and drops extra fields", () => {
    const pieces = [
      { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 3, index: 0 },
      { book: "Psalms", chapter: 23, startVerse: 4, endVerse: 6, index: 1 },
    ];
    expect(passageHeartSpans(pieces)).toEqual([
      { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 6 },
    ]);
    expect(pieces[0]).toEqual({
      book: "Psalms",
      chapter: 23,
      startVerse: 1,
      endVerse: 3,
      index: 0,
    });
  });

  it("returns nothing for no pieces", () => {
    expect(passageHeartSpans([])).toEqual([]);
  });
});
