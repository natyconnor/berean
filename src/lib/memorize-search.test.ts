import { describe, expect, it } from "vitest";

import {
  heartMatchesSearch,
  memorizeSearch,
  parseReferenceSpan,
} from "./memorize-search";

describe("parseReferenceSpan", () => {
  it("reads a verse, a range and a whole chapter", () => {
    expect(parseReferenceSpan("John 14:27")).toEqual({
      kind: "match",
      span: { book: "John", chapter: 14, startVerse: 27, endVerse: 27 },
    });
    expect(parseReferenceSpan("Rom 8:28–30")).toEqual({
      kind: "match",
      span: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 30 },
    });
    expect(parseReferenceSpan("Psalm 1")).toEqual({
      kind: "match",
      span: { book: "Psalms", chapter: 1, startVerse: 1, endVerse: 6 },
    });
  });

  it("does not search words", () => {
    expect(parseReferenceSpan("  ")).toEqual({ kind: "empty" });
    expect(parseReferenceSpan("anxious")).toEqual({ kind: "noMatch" });
  });

  it("explains a verse past the end of the chapter", () => {
    expect(parseReferenceSpan("John 14:99")).toEqual({
      kind: "outOfRange",
      message: "John 14 only has 31 verses.",
    });
  });
});

describe("memorizeSearch", () => {
  it("is empty for blank text", () => {
    expect(memorizeSearch("   ")).toEqual({ kind: "empty" });
  });

  it("turns a chapter into a passage, using its preset when there is one", () => {
    expect(memorizeSearch("Psalm 23")).toEqual({
      kind: "match",
      target: {
        kind: "chapters",
        book: "Psalms",
        startChapter: 23,
        endChapter: 23,
        presetId: "psalm-23",
        title: "Psalm 23",
      },
      title: "Psalm 23",
      planLine: "6 verses · learn it in about 4 days",
    });
    expect(memorizeSearch("Jude 1")).toMatchObject({
      kind: "match",
      title: "Jude 1",
      target: { kind: "chapters", book: "Jude", startChapter: 1 },
    });
  });

  it("turns a verse or a short range into one card", () => {
    expect(memorizeSearch("Romans 8:28")).toEqual({
      kind: "match",
      target: {
        kind: "spans",
        spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
      },
      title: "Romans 8:28",
      planLine: "Learn it in about 3 days",
    });
    expect(memorizeSearch("Philippians 4:6–7")).toMatchObject({
      kind: "match",
      title: "Philippians 4:6–7",
      planLine: "2 verses · learn it in about 3 days",
    });
  });

  it("finds nothing for text that is not a reference or past the chapter", () => {
    expect(memorizeSearch("Psa")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Nowhere 3")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("John 3:99")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Jude 2")).toEqual({ kind: "noMatch" });
  });
});

describe("heartMatchesSearch", () => {
  const romans828 = {
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
  };
  const psalm231 = { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 1 };

  it("matches everything for blank text", () => {
    expect(heartMatchesSearch(romans828, "")).toBe(true);
  });

  it("keeps hearts inside a typed reference", () => {
    expect(heartMatchesSearch(psalm231, "Psalm 23")).toBe(true);
    expect(heartMatchesSearch(psalm231, "Psalm 2")).toBe(false);
    expect(heartMatchesSearch(romans828, "Romans 8:27-30")).toBe(true);
    expect(heartMatchesSearch(romans828, "Romans 8:1")).toBe(false);
  });

  it("matches a book name, abbreviation, or partial text", () => {
    expect(heartMatchesSearch(romans828, "Romans")).toBe(true);
    expect(heartMatchesSearch(romans828, "rom")).toBe(true);
    expect(heartMatchesSearch(psalm231, "Psalm")).toBe(true);
    expect(heartMatchesSearch(romans828, "John")).toBe(false);
  });
});
