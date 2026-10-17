import { describe, expect, it } from "vitest";

import { AUTO_HEART_MAX_CHAPTERS } from "./scope-chapter-count";
import {
  packAllowsPassageMode,
  piecesAllowPassageMode,
  rangeAllowsPassageMode,
} from "./passage-eligibility";
import { buildPassagePieces } from "./passage-pieces";
import type { PassageRange } from "./passage-range";
import type { VerseScope } from "./verse-scope-match";

function range(
  book: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
): PassageRange {
  return { book, startChapter, startVerse, endChapter, endVerse };
}

describe("rangeAllowsPassageMode", () => {
  it.each([
    ["Philippians 2:1–11", range("Philippians", 2, 1, 2, 11)],
    ["Matthew 6:9–13", range("Matthew", 6, 9, 6, 13)],
    ["Romans 8:28–39", range("Romans", 8, 28, 8, 39)],
    ["Romans 7:24–8:2", range("Romans", 7, 24, 8, 2)],
  ])("allows %s", (_label, passage) => {
    expect(rangeAllowsPassageMode(passage)).toBe(true);
  });

  it.each([
    ["John 3:16", range("John", 3, 16, 3, 16)],
    ["Psalm 117", range("Psalms", 117, 1, 117, 2)],
    ["three verses", range("Romans", 8, 28, 8, 30)],
    ["out of order", range("Romans", 8, 30, 8, 28)],
    ["past the chapter's end", range("Romans", 8, 28, 8, 40)],
    ["more than 20 chapters", range("Psalms", 1, 3, 21, 1)],
  ])("rejects %s", (_label, passage) => {
    expect(rangeAllowsPassageMode(passage)).toBe(false);
  });

  it("allows exactly 20 chapters", () => {
    expect(rangeAllowsPassageMode(range("Psalms", 1, 3, 20, 1))).toBe(true);
  });

  it("makes a 4-verse range that groups into one piece one card", () => {
    const short = range("Psalms", 134, 1, 134, 4);
    const pieces = buildPassagePieces(
      [
        {
          book: "Psalms",
          chapter: 134,
          verses: [1, 2, 3, 4].map((number) => ({
            number,
            text: "Come, bless the Lord,",
          })),
        },
      ],
      short,
    );
    expect(rangeAllowsPassageMode(short, () => 4)).toBe(true);
    expect(pieces).toHaveLength(1);
    expect(piecesAllowPassageMode(pieces.length)).toBe(false);
    expect(piecesAllowPassageMode(2)).toBe(true);
  });
});

describe("packAllowsPassageMode", () => {
  it("allows a single contiguous chapter", () => {
    const john3: VerseScope = {
      books: ["John"],
      chapterRanges: [{ book: "John", startChapter: 3, endChapter: 3 }],
    };
    expect(packAllowsPassageMode(john3)).toBe(true);
  });

  it("allows a contiguous range up to AUTO_HEART_MAX_CHAPTERS", () => {
    const john3to5: VerseScope = {
      books: ["John"],
      chapterRanges: [{ book: "John", startChapter: 3, endChapter: 5 }],
    };
    expect(packAllowsPassageMode(john3to5)).toBe(true);

    const atCap: VerseScope = {
      books: ["John"],
      chapterRanges: [
        { book: "John", startChapter: 1, endChapter: AUTO_HEART_MAX_CHAPTERS },
      ],
    };
    expect(packAllowsPassageMode(atCap)).toBe(true);
  });

  it("rejects over-cap and non-contiguous scopes", () => {
    const wholeJohn: VerseScope = { books: ["John"] };
    expect(packAllowsPassageMode(wholeJohn)).toBe(false);

    const psalms: VerseScope = { books: ["Psalms"] };
    expect(packAllowsPassageMode(psalms)).toBe(false);

    const empty: VerseScope = { books: [] };
    expect(packAllowsPassageMode(empty)).toBe(false);

    const john1to2: VerseScope = {
      books: ["John"],
      chapterRanges: [{ book: "John", startChapter: 1, endChapter: 2 }],
    };
    expect(packAllowsPassageMode(john1to2)).toBe(true);

    const multiBook: VerseScope = {
      books: ["John", "Acts"],
      chapterRanges: [
        { book: "John", startChapter: 1, endChapter: 1 },
        { book: "Acts", startChapter: 1, endChapter: 1 },
      ],
    };
    expect(packAllowsPassageMode(multiBook)).toBe(false);
  });
});
