import { describe, expect, it } from "vitest";

import { verseMatchesScope, type VerseScope } from "./verse-scope-match";

describe("verseMatchesScope", () => {
  it("matches every verse when books is empty", () => {
    const scope: VerseScope = { books: [] };
    expect(verseMatchesScope({ book: "John", chapter: 3 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "Genesis", chapter: 1 }, scope)).toBe(
      true,
    );
  });

  it("matches only verses whose book is in the list", () => {
    const scope: VerseScope = { books: ["John", "Romans"] };
    expect(verseMatchesScope({ book: "John", chapter: 3 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "Romans", chapter: 8 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "Genesis", chapter: 1 }, scope)).toBe(
      false,
    );
  });

  it("matches all chapters of a listed book that has no range", () => {
    const scope: VerseScope = { books: ["John"], chapterRanges: [] };
    expect(verseMatchesScope({ book: "John", chapter: 1 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "John", chapter: 21 }, scope)).toBe(true);
  });

  it("respects a chapter range for a book (in-range vs out-of-range)", () => {
    const scope: VerseScope = {
      books: ["John"],
      chapterRanges: [{ book: "John", startChapter: 3, endChapter: 5 }],
    };
    expect(verseMatchesScope({ book: "John", chapter: 2 }, scope)).toBe(false);
    expect(verseMatchesScope({ book: "John", chapter: 3 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "John", chapter: 5 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "John", chapter: 6 }, scope)).toBe(false);
  });

  it("applies multiple per-book ranges independently", () => {
    const scope: VerseScope = {
      books: ["John", "Romans"],
      chapterRanges: [
        { book: "John", startChapter: 1, endChapter: 3 },
        { book: "Romans", startChapter: 8, endChapter: 8 },
      ],
    };
    expect(verseMatchesScope({ book: "John", chapter: 2 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "John", chapter: 4 }, scope)).toBe(false);
    expect(verseMatchesScope({ book: "Romans", chapter: 8 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "Romans", chapter: 9 }, scope)).toBe(
      false,
    );
  });

  it("matches all chapters when a book is listed but only other books have ranges", () => {
    const scope: VerseScope = {
      books: ["John", "Romans"],
      chapterRanges: [{ book: "Romans", startChapter: 8, endChapter: 8 }],
    };
    // John has no range -> every John chapter matches.
    expect(verseMatchesScope({ book: "John", chapter: 1 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "John", chapter: 21 }, scope)).toBe(true);
    // Romans still constrained by its range.
    expect(verseMatchesScope({ book: "Romans", chapter: 8 }, scope)).toBe(true);
    expect(verseMatchesScope({ book: "Romans", chapter: 9 }, scope)).toBe(
      false,
    );
  });
});
