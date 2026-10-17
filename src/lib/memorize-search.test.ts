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

function planLine(text: string): string | undefined {
  const result = memorizeSearch(text);
  return result.kind === "match" ? result.planLine : undefined;
}

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
    expect(memorizeSearch("Jude")).toMatchObject({
      kind: "match",
      title: "Jude",
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
    expect(memorizeSearch("Jude 1")).toMatchObject({
      kind: "match",
      title: "Jude 1:1",
      target: {
        kind: "spans",
        spans: [{ book: "Jude", chapter: 1, startVerse: 1, endVerse: 1 }],
      },
    });
    expect(memorizeSearch("Jude 2")).toMatchObject({
      kind: "match",
      title: "Jude 1:2",
    });
    expect(memorizeSearch("Jude 1-3")).toMatchObject({
      kind: "match",
      title: "Jude 1:1–3",
    });
  });

  it("finds nothing for text that is not a reference or past the chapter", () => {
    expect(memorizeSearch("Psa")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Nowhere 3")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("John 3:99")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Jude 26")).toEqual({ kind: "noMatch" });
  });

  it("turns a chapter range into one passage, using its preset when there is one", () => {
    const sermon = memorizeSearch("Matthew 5-7");
    expect(sermon).toMatchObject({
      kind: "match",
      target: {
        kind: "chapters",
        book: "Matthew",
        startChapter: 5,
        endChapter: 7,
        presetId: "matthew-5-7",
        title: "Sermon on the Mount",
      },
      title: "Sermon on the Mount",
    });
    expect(planLine("Matthew 5-7")).toMatch(/^111 verses · learn it in about/);
    expect(memorizeSearch("Matthew 5–7")).toEqual(sermon);
    expect(memorizeSearch("Matt 5 - 7")).toEqual(sermon);

    expect(memorizeSearch("Psalm 23-24")).toMatchObject({
      kind: "match",
      target: {
        kind: "chapters",
        book: "Psalms",
        startChapter: 23,
        endChapter: 24,
      },
      title: "Psalm 23–24",
    });
    expect(memorizeSearch("Psalm 23-24")).not.toHaveProperty("target.presetId");
    expect(planLine("Psalm 23-24")).toMatch(/^16 verses · /);
    expect(memorizeSearch("Psalm 23-24")).not.toHaveProperty("alternate");
  });

  it("reads an ambiguous Book A-B as verse A:B unless a suggested passage covers the chapters", () => {
    expect(memorizeSearch("John 3-16")).toMatchObject({
      kind: "match",
      title: "John 3:16",
      target: {
        kind: "spans",
        spans: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }],
      },
      alternate: {
        title: "John 3–16",
        target: { kind: "chapters", startChapter: 3, endChapter: 16 },
      },
    });
    expect(memorizeSearch("Matthew 5-7")).toMatchObject({
      title: "Sermon on the Mount",
      alternate: { title: "Matthew 5:7" },
    });
  });

  it("names a whole chapter after a preset only when the preset is the whole chapter", () => {
    expect(memorizeSearch("Matthew 6")).toMatchObject({
      kind: "match",
      title: "Matthew 6",
      target: {
        kind: "chapters",
        book: "Matthew",
        startChapter: 6,
        endChapter: 6,
      },
    });
    expect(memorizeSearch("Matthew 6")).not.toHaveProperty("target.presetId");
    expect(memorizeSearch("Psalm 23-23")).toMatchObject({
      target: { presetId: "psalm-23" },
    });
  });

  it("turns a range across chapters into spans the resolver joins into one passage", () => {
    const crossChapter = memorizeSearch("Romans 7:24–8:2");
    expect(crossChapter).toMatchObject({
      kind: "match",
      title: "Romans 7:24–8:2",
    });
    expect(crossChapter.kind === "match" && crossChapter.target).toEqual({
      kind: "spans",
      spans: [
        { book: "Romans", chapter: 7, startVerse: 24, endVerse: 25 },
        { book: "Romans", chapter: 8, startVerse: 1, endVerse: 2 },
      ],
      title: "Romans 7:24–8:2",
    });
    expect(planLine("Romans 7:24-8:2")).toMatch(/^4 verses · /);
    expect(memorizeSearch("Romans 8:28-8:30")).toMatchObject({
      kind: "match",
      title: "Romans 8:28–30",
      target: {
        kind: "spans",
        spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 30 }],
      },
    });
  });

  it("finds nothing for a range out of order or past the book or chapter", () => {
    expect(memorizeSearch("Matthew 7-5")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Matthew 27-29")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Romans 7:26-8:2")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Romans 8:2-7:24")).toEqual({ kind: "noMatch" });
    expect(memorizeSearch("Nowhere 1-2")).toEqual({ kind: "noMatch" });
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

  it("keeps hearts inside a typed chapter range or cross-chapter range", () => {
    const matthew633 = {
      book: "Matthew",
      chapter: 6,
      startVerse: 33,
      endVerse: 33,
    };
    expect(heartMatchesSearch(matthew633, "Matthew 5-7")).toBe(true);
    expect(heartMatchesSearch(matthew633, "Matthew 8–9")).toBe(false);

    const romans81 = { book: "Romans", chapter: 8, startVerse: 1, endVerse: 1 };
    const romans725 = {
      book: "Romans",
      chapter: 7,
      startVerse: 25,
      endVerse: 25,
    };
    expect(heartMatchesSearch(romans81, "Romans 7:24-8:2")).toBe(true);
    expect(heartMatchesSearch(romans725, "Romans 7:24-8:2")).toBe(true);
    expect(heartMatchesSearch(romans828, "Romans 7:24-8:2")).toBe(false);
  });

  it("matches a book name, abbreviation, or partial text", () => {
    expect(heartMatchesSearch(romans828, "Romans")).toBe(true);
    expect(heartMatchesSearch(romans828, "rom")).toBe(true);
    expect(heartMatchesSearch(psalm231, "Psalm")).toBe(true);
    expect(heartMatchesSearch(romans828, "John")).toBe(false);
  });
});
