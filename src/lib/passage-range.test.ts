import { describe, expect, it } from "vitest";

import type { VerseSpan } from "./hearted-verse-coverage";
import {
  contiguousRange,
  formatPassageRange,
  rangeChapterSpans,
  rangeCoversChapter,
  rangeCoversWholeChapters,
  rangeVerseCount,
  spanInPackScope,
  spanInRange,
  trimChapterVerses,
  verseInRange,
  type PassageRange,
} from "./passage-range";

function range(
  book: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
): PassageRange {
  return { book, startChapter, startVerse, endChapter, endVerse };
}

function span(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): VerseSpan {
  return { book, chapter, startVerse, endVerse };
}

const PHIL_2_1_11 = range("Philippians", 2, 1, 2, 11);
const ROM_7_24_8_2 = range("Romans", 7, 24, 8, 2);

describe("verseInRange / spanInRange", () => {
  it("checks book, chapter, and the verse bounds at each end", () => {
    const at = (chapter: number, verse: number) =>
      verseInRange({ book: "Romans", chapter, verse }, ROM_7_24_8_2);
    expect(at(7, 23)).toBe(false);
    expect(at(7, 24)).toBe(true);
    expect(at(7, 25)).toBe(true);
    expect(at(8, 1)).toBe(true);
    expect(at(8, 2)).toBe(true);
    expect(at(8, 3)).toBe(false);
    expect(at(6, 24)).toBe(false);
    expect(
      verseInRange({ book: "John", chapter: 7, verse: 24 }, ROM_7_24_8_2),
    ).toBe(false);
  });

  it("needs the whole span inside", () => {
    expect(spanInRange(span("Philippians", 2, 5, 11), PHIL_2_1_11)).toBe(true);
    expect(spanInRange(span("Philippians", 2, 10, 12), PHIL_2_1_11)).toBe(
      false,
    );
    expect(spanInRange(span("Philippians", 2, 12, 18), PHIL_2_1_11)).toBe(
      false,
    );
  });

  it("keeps hearts in Philippians 2:12–30 out of a 2:1–11 pack", () => {
    const scope = {
      books: ["Philippians"],
      chapterRanges: [{ book: "Philippians", startChapter: 2, endChapter: 2 }],
    };
    const hearts = [
      span("Philippians", 2, 3, 4),
      span("Philippians", 2, 12, 13),
      span("Philippians", 2, 30),
      span("Philippians", 3, 1),
    ];
    expect(
      hearts.filter((heart) => spanInPackScope(heart, scope, PHIL_2_1_11)),
    ).toEqual([span("Philippians", 2, 3, 4)]);
    expect(
      hearts.filter((heart) => spanInPackScope(heart, scope, undefined)),
    ).toEqual(hearts.slice(0, 3));
  });
});

describe("rangeVerseCount / rangeChapterSpans", () => {
  it("counts verses across chapters", () => {
    expect(rangeVerseCount(PHIL_2_1_11)).toBe(11);
    expect(rangeVerseCount(range("Matthew", 6, 9, 6, 13))).toBe(5);
    expect(rangeVerseCount(range("Romans", 8, 28, 8, 39))).toBe(12);
    expect(rangeVerseCount(ROM_7_24_8_2)).toBe(4);
    expect(rangeChapterSpans(ROM_7_24_8_2)).toEqual([
      span("Romans", 7, 24, 25),
      span("Romans", 8, 1, 2),
    ]);
  });

  it("rejects ranges out of order or past a chapter's end", () => {
    expect(rangeVerseCount(range("Romans", 8, 3, 8, 2))).toBeNull();
    expect(rangeVerseCount(range("Romans", 8, 1, 7, 2))).toBeNull();
    expect(rangeVerseCount(range("Romans", 8, 1, 8, 40))).toBeNull();
    expect(rangeVerseCount(range("Romans", 7, 26, 8, 2))).toBeNull();
    expect(rangeVerseCount(range("Romans", 0, 1, 1, 2))).toBeNull();
    expect(rangeVerseCount(range("Nope", 1, 1, 1, 2))).toBeNull();
  });
});

describe("rangeCoversChapter / rangeCoversWholeChapters", () => {
  it("knows which chapters a range only partly covers", () => {
    const range7to8 = range("Romans", 7, 24, 8, 39);
    expect(rangeCoversChapter(range7to8, 7)).toBe(false);
    expect(rangeCoversChapter(range7to8, 8)).toBe(true);
    expect(rangeCoversChapter(range("Romans", 6, 1, 8, 2), 7)).toBe(true);
    expect(rangeCoversChapter(PHIL_2_1_11, 2)).toBe(false);
    expect(rangeCoversChapter(PHIL_2_1_11, 3)).toBe(false);
  });

  it("treats a range from verse 1 to the last verse as whole chapters", () => {
    expect(rangeCoversWholeChapters(range("Psalms", 23, 1, 23, 6))).toBe(true);
    expect(rangeCoversWholeChapters(range("Romans", 7, 1, 8, 39))).toBe(true);
    expect(rangeCoversWholeChapters(PHIL_2_1_11)).toBe(false);
    expect(rangeCoversWholeChapters(range("Romans", 7, 24, 8, 39))).toBe(false);
  });
});

describe("formatPassageRange", () => {
  it("formats one-chapter, cross-chapter, and one-verse ranges", () => {
    expect(formatPassageRange(PHIL_2_1_11)).toBe("Philippians 2:1\u201311");
    expect(formatPassageRange(ROM_7_24_8_2)).toBe("Romans 7:24\u20138:2");
    expect(formatPassageRange(range("John", 3, 16, 3, 16))).toBe("John 3:16");
    expect(formatPassageRange(range("Psalms", 23, 1, 23, 4))).toBe(
      "Psalm 23:1\u20134",
    );
  });
});

describe("trimChapterVerses", () => {
  const verses = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      number: from + i,
      text: `v${from + i}`,
    }));

  it("drops verses outside the range at each end", () => {
    expect(
      trimChapterVerses(
        { book: "Romans", chapter: 7, verses: verses(1, 25) },
        ROM_7_24_8_2,
      ).verses.map((verse) => verse.number),
    ).toEqual([24, 25]);
    expect(
      trimChapterVerses(
        { book: "Romans", chapter: 8, verses: verses(1, 39) },
        ROM_7_24_8_2,
      ).verses.map((verse) => verse.number),
    ).toEqual([1, 2]);
    expect(
      trimChapterVerses(
        { book: "Romans", chapter: 9, verses: verses(1, 33) },
        ROM_7_24_8_2,
      ).verses,
    ).toEqual([]);
  });
});

describe("contiguousRange", () => {
  it("joins spans in any order, overlapping or adjacent", () => {
    expect(
      contiguousRange([
        span("Philippians", 2, 6, 11),
        span("Philippians", 2, 1, 6),
      ]),
    ).toEqual(PHIL_2_1_11);
    expect(
      contiguousRange([span("Romans", 8, 1, 2), span("Romans", 7, 24, 25)]),
    ).toEqual(ROM_7_24_8_2);
  });

  it("rejects gaps, other books, and runs that skip a chapter's end", () => {
    expect(
      contiguousRange([
        span("Philippians", 2, 1, 4),
        span("Philippians", 2, 6, 11),
      ]),
    ).toBeNull();
    expect(
      contiguousRange([span("Romans", 8, 28), span("John", 3, 16)]),
    ).toBeNull();
    expect(
      contiguousRange([span("Romans", 7, 24), span("Romans", 8, 1, 2)]),
    ).toBeNull();
    expect(
      contiguousRange([span("Romans", 7, 24, 25), span("Romans", 8, 2, 3)]),
    ).toBeNull();
    expect(
      contiguousRange([span("Romans", 6, 23), span("Romans", 8, 1)]),
    ).toBeNull();
    expect(contiguousRange([])).toBeNull();
  });
});
