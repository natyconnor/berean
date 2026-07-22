import { describe, expect, it } from "vitest";
import {
  formatVerseRef,
  isChapterScopeRef,
  parseVerseRef,
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
