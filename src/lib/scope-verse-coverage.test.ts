import { describe, expect, it } from "vitest";

import { getChapterVerseCount } from "./bible-verse-counts";
import type { VerseSpan } from "./hearted-verse-coverage";
import {
  coveredVerseCount,
  scopeCoverageComplete,
  scopeVerseSlots,
} from "./scope-verse-coverage";
import type { VerseScope } from "./verse-scope-match";

const JOHN_3: VerseScope = {
  books: ["John"],
  chapterRanges: [{ book: "John", startChapter: 3, endChapter: 3 }],
};

const JOHN_3_VERSES = getChapterVerseCount("John", 3) ?? 0;

function span(
  startVerse: number,
  endVerse: number,
  book = "John",
  chapter = 3,
): VerseSpan {
  return { book, chapter, startVerse, endVerse };
}

describe("scope verse coverage", () => {
  it("counts every 1..getChapterVerseCount slot in enumerated chapters", () => {
    expect(JOHN_3_VERSES).toBe(36);
    expect(scopeVerseSlots(JOHN_3)).toBe(36);
    expect(
      scopeVerseSlots({
        books: ["Jude", "Philemon"],
      }),
    ).toBe(25 + 25);
  });

  it("is complete only when every slot is covered; a hole fails", () => {
    const full = [span(1, JOHN_3_VERSES)];
    expect(coveredVerseCount(JOHN_3, full)).toBe(JOHN_3_VERSES);
    expect(scopeCoverageComplete(JOHN_3, full)).toBe(true);

    const hole = [span(1, 15), span(17, JOHN_3_VERSES)];
    expect(coveredVerseCount(JOHN_3, hole)).toBe(JOHN_3_VERSES - 1);
    expect(scopeCoverageComplete(JOHN_3, hole)).toBe(false);

    const partial = [span(16, 18)];
    expect(coveredVerseCount(JOHN_3, partial)).toBe(3);
    expect(scopeCoverageComplete(JOHN_3, partial)).toBe(false);
  });

  it("only counts hearts whose book and chapter match the slot", () => {
    const wrongBook = [span(1, JOHN_3_VERSES, "Romans", 3)];
    expect(coveredVerseCount(JOHN_3, wrongBook)).toBe(0);
    expect(scopeCoverageComplete(JOHN_3, wrongBook)).toBe(false);

    const wrongChapter = [span(1, JOHN_3_VERSES, "John", 4)];
    expect(coveredVerseCount(JOHN_3, wrongChapter)).toBe(0);
  });
});
