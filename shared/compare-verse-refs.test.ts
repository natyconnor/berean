import { describe, expect, it } from "vitest";

import { compareVerseRefs, sortByVerseRef } from "./compare-verse-refs";

describe("compareVerseRefs", () => {
  it("orders by canonical book, then chapter and verse", () => {
    expect(
      compareVerseRefs(
        { book: "John", chapter: 3, startVerse: 17, endVerse: 17 },
        { book: "John", chapter: 3, startVerse: 16, endVerse: 16 },
      ),
    ).toBeGreaterThan(0);
    expect(
      compareVerseRefs(
        { book: "Matthew", chapter: 5, startVerse: 1, endVerse: 12 },
        { book: "John", chapter: 1, startVerse: 1, endVerse: 1 },
      ),
    ).toBeLessThan(0);
    expect(
      compareVerseRefs(
        { book: "Genesis", chapter: 1, startVerse: 1, endVerse: 1 },
        { book: "Exodus", chapter: 1, startVerse: 1, endVerse: 1 },
      ),
    ).toBeLessThan(0);
  });

  it("sortByVerseRef returns a new array in Bible order", () => {
    const input = [
      { book: "John", chapter: 3, startVerse: 16, endVerse: 16, _id: "b" },
      { book: "Genesis", chapter: 1, startVerse: 1, endVerse: 1, _id: "a" },
      { book: "John", chapter: 3, startVerse: 17, endVerse: 17, _id: "c" },
    ];
    expect(sortByVerseRef(input).map((v) => v._id)).toEqual(["a", "b", "c"]);
    expect(input.map((v) => v._id)).toEqual(["b", "a", "c"]);
  });
});
