import { describe, expect, it } from "vitest";

import { AUTO_HEART_MAX_CHAPTERS } from "./scope-chapter-count";
import { packAllowsPassageMode } from "./passage-eligibility";
import type { VerseScope } from "./verse-scope-match";

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
