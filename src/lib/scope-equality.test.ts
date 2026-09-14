import { describe, expect, it } from "vitest";
import { scopesEqual, type FullScope } from "./scope-equality";

const base: FullScope = {
  books: ["John", "Romans"],
  chapterRanges: [{ book: "John", startChapter: 1, endChapter: 3 }],
  tags: ["faith", "grace"],
  tagMatchMode: "any",
};

describe("scopesEqual", () => {
  it("returns true for identical scopes", () => {
    expect(scopesEqual(base, { ...base })).toBe(true);
  });

  it("ignores book and tag order", () => {
    expect(
      scopesEqual(base, {
        ...base,
        books: ["Romans", "John"],
        tags: ["grace", "faith"],
      }),
    ).toBe(true);
  });

  it("treats missing and empty chapterRanges as equal", () => {
    const withoutRanges: FullScope = {
      books: ["John"],
      tags: [],
      tagMatchMode: "all",
    };
    expect(
      scopesEqual(withoutRanges, {
        ...withoutRanges,
        chapterRanges: [],
      }),
    ).toBe(true);
  });

  it("ignores chapterRanges order", () => {
    expect(
      scopesEqual(
        {
          books: ["John", "Romans"],
          chapterRanges: [
            { book: "Romans", startChapter: 8, endChapter: 8 },
            { book: "John", startChapter: 1, endChapter: 3 },
          ],
          tags: [],
          tagMatchMode: "any",
        },
        {
          books: ["John", "Romans"],
          chapterRanges: [
            { book: "John", startChapter: 1, endChapter: 3 },
            { book: "Romans", startChapter: 8, endChapter: 8 },
          ],
          tags: [],
          tagMatchMode: "any",
        },
      ),
    ).toBe(true);
  });

  it("returns false when books differ", () => {
    expect(
      scopesEqual(base, {
        ...base,
        books: ["John"],
      }),
    ).toBe(false);
  });

  it("returns false when tags differ", () => {
    expect(
      scopesEqual(base, {
        ...base,
        tags: ["faith"],
      }),
    ).toBe(false);
  });

  it("returns false when tagMatchMode differs", () => {
    expect(
      scopesEqual(base, {
        ...base,
        tagMatchMode: "all",
      }),
    ).toBe(false);
  });

  it("returns false when chapter ranges differ", () => {
    expect(
      scopesEqual(base, {
        ...base,
        chapterRanges: [{ book: "John", startChapter: 1, endChapter: 5 }],
      }),
    ).toBe(false);
  });

  it("treats whole-book and full chapter-range scopes as equal", () => {
    expect(
      scopesEqual(
        { books: ["Jude"], tags: [], tagMatchMode: "any" },
        {
          books: ["Jude"],
          chapterRanges: [{ book: "Jude", startChapter: 1, endChapter: 1 }],
          tags: [],
          tagMatchMode: "any",
        },
      ),
    ).toBe(true);
  });

  it("does not collapse a partial psalm range into the whole book", () => {
    expect(
      scopesEqual(
        { books: ["Psalms"], tags: [], tagMatchMode: "any" },
        {
          books: ["Psalms"],
          chapterRanges: [{ book: "Psalms", startChapter: 23, endChapter: 23 }],
          tags: [],
          tagMatchMode: "any",
        },
      ),
    ).toBe(false);
  });
});
