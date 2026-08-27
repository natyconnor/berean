import { describe, expect, it } from "vitest";
import {
  formatBookChapter,
  formatVerseRef,
  isChapterScopeRef,
  parseVerseRef,
  unionVerseRefs,
  formatVerseRange,
  verseRefsHaveMixedRanges,
} from "./verse-ref-utils";

describe("parseVerseRef", () => {
  it("parses single verses and ranges", () => {
    expect(parseVerseRef("John 3:16")).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
    expect(parseVerseRef("Romans 8:28-30")).toEqual({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 30,
    });
  });

  it("rejects chapter-only input by default", () => {
    expect(parseVerseRef("John 3")).toBeNull();
  });

  it("parses chapter-only input when allowChapterOnly is enabled", () => {
    expect(parseVerseRef("John 3", { allowChapterOnly: true })).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
  });

  it("rejects invalid chapters even with allowChapterOnly", () => {
    expect(parseVerseRef("Jude 2", { allowChapterOnly: true })).toBeNull();
    expect(parseVerseRef("John 99", { allowChapterOnly: true })).toBeNull();
  });

  it("keeps compact @3 as a verse in the current chapter", () => {
    expect(
      parseVerseRef("3", {
        defaultBook: "John",
        defaultChapter: 3,
        allowChapterOnly: true,
      }),
    ).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 3,
      endVerse: 3,
    });
  });

  it("still prefers verse syntax when a colon is present", () => {
    expect(parseVerseRef("John 3:16", { allowChapterOnly: true })).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
  });
});

describe("formatVerseRef", () => {
  it("formats chapter-scoped refs without a verse", () => {
    expect(
      formatVerseRef({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe("John 3");
  });

  it("formats verse and range refs unchanged", () => {
    expect(
      formatVerseRef({
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
      }),
    ).toBe("John 3:16");
    expect(
      formatVerseRef({
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 18,
      }),
    ).toBe("John 3:16-18");
  });

  it("uses Psalm for a specific psalm chapter or verse", () => {
    expect(formatBookChapter("Psalms", 1)).toBe("Psalm 1");
    expect(
      formatVerseRef({
        book: "Psalms",
        chapter: 1,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe("Psalm 1");
    expect(
      formatVerseRef({
        book: "Psalms",
        chapter: 23,
        startVerse: 1,
        endVerse: 1,
      }),
    ).toBe("Psalm 23:1");
    expect(
      formatVerseRef({
        book: "Psalms",
        chapter: 119,
        startVerse: 1,
        endVerse: 16,
      }),
    ).toBe("Psalm 119:1-16");
  });
});

describe("unionVerseRefs", () => {
  it("returns null for an empty list", () => {
    expect(unionVerseRefs([])).toBeNull();
  });

  it("returns a copy of a single ref", () => {
    expect(
      unionVerseRefs([
        { book: "2 Samuel", chapter: 23, startVerse: 9, endVerse: 11 },
      ]),
    ).toEqual({
      book: "2 Samuel",
      chapter: 23,
      startVerse: 9,
      endVerse: 11,
    });
  });

  it("unions overlapping ranges that share a start verse", () => {
    expect(
      unionVerseRefs([
        { book: "2 Samuel", chapter: 23, startVerse: 9, endVerse: 11 },
        { book: "2 Samuel", chapter: 23, startVerse: 9, endVerse: 12 },
      ]),
    ).toEqual({
      book: "2 Samuel",
      chapter: 23,
      startVerse: 9,
      endVerse: 12,
    });
  });
});

describe("formatVerseRange", () => {
  it("formats a single verse and a span", () => {
    expect(formatVerseRange({ startVerse: 9, endVerse: 9 })).toBe("9");
    expect(formatVerseRange({ startVerse: 7, endVerse: 8 })).toBe("7-8");
  });
});

describe("verseRefsHaveMixedRanges", () => {
  const john17 = {
    book: "John",
    chapter: 1,
    startVerse: 7,
    endVerse: 9,
  };

  it("is false for one ref or identical ranges", () => {
    expect(verseRefsHaveMixedRanges([john17])).toBe(false);
    expect(
      verseRefsHaveMixedRanges([
        john17,
        { ...john17, startVerse: 7, endVerse: 9 },
      ]),
    ).toBe(false);
  });

  it("is true when end verses differ", () => {
    expect(
      verseRefsHaveMixedRanges([
        john17,
        { ...john17, startVerse: 7, endVerse: 8 },
      ]),
    ).toBe(true);
  });
});

describe("isChapterScopeRef", () => {
  it("detects chapter scope", () => {
    expect(
      isChapterScopeRef({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe(true);
    expect(
      isChapterScopeRef({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
      }),
    ).toBe(false);
  });
});
