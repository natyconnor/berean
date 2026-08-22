import { describe, expect, it } from "vitest";

import {
  autoHeartAllowed,
  countScopeChapters,
  enumerateScopeChapters,
} from "./scope-chapter-count";
import type { VerseScope } from "./verse-scope-match";

describe("enumerateScopeChapters / countScopeChapters / autoHeartAllowed", () => {
  it("allows Jude (1 chapter) and rejects Psalms (150) and empty books", () => {
    const jude: VerseScope = { books: ["Jude"] };
    expect(enumerateScopeChapters(jude)).toEqual([
      { book: "Jude", chapter: 1 },
    ]);
    expect(countScopeChapters(jude)).toBe(1);
    expect(autoHeartAllowed(jude)).toBe(true);

    const psalms: VerseScope = { books: ["Psalms"] };
    expect(countScopeChapters(psalms)).toBe(150);
    expect(enumerateScopeChapters(psalms)).toHaveLength(150);
    expect(autoHeartAllowed(psalms)).toBe(false);

    const empty: VerseScope = { books: [] };
    expect(enumerateScopeChapters(empty)).toEqual([]);
    expect(countScopeChapters(empty)).toBe(Infinity);
    expect(autoHeartAllowed(empty)).toBe(false);
  });

  it("expands a listed book with no range via getBookInfo", () => {
    const john: VerseScope = { books: ["John"] };
    expect(countScopeChapters(john)).toBe(21);
    expect(enumerateScopeChapters(john)[0]).toEqual({
      book: "John",
      chapter: 1,
    });
    expect(enumerateScopeChapters(john).at(-1)).toEqual({
      book: "John",
      chapter: 21,
    });
    expect(autoHeartAllowed(john)).toBe(false);
  });

  it("uses chapterRange when present", () => {
    const john3to5: VerseScope = {
      books: ["John"],
      chapterRanges: [{ book: "John", startChapter: 3, endChapter: 5 }],
    };
    expect(enumerateScopeChapters(john3to5)).toEqual([
      { book: "John", chapter: 3 },
      { book: "John", chapter: 4 },
      { book: "John", chapter: 5 },
    ]);
    expect(countScopeChapters(john3to5)).toBe(3);
    expect(autoHeartAllowed(john3to5)).toBe(true);
  });
});
