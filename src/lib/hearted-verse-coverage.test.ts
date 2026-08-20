import { describe, expect, it } from "vitest";

import {
  coveringSpans,
  exactSpanMatch,
  heartedRunsForChapter,
  overlappingSpans,
  spanCoversVerse,
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
