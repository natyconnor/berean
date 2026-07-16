import { describe, expect, it } from "vitest";

import {
  hasPracticeVerseScope,
  validateMemoryPracticeSearch,
} from "./memory-practice-search";

describe("validateMemoryPracticeSearch", () => {
  it("returns empty when any required field is missing", () => {
    expect(validateMemoryPracticeSearch({})).toEqual({});
    expect(validateMemoryPracticeSearch({ book: "John", chapter: 3 })).toEqual(
      {},
    );
    expect(
      validateMemoryPracticeSearch({
        book: "John",
        chapter: 3,
        startVerse: "x",
      }),
    ).toEqual({});
  });

  it("normalizes a complete verse scope", () => {
    expect(
      validateMemoryPracticeSearch({
        book: " John ",
        chapter: "3",
        startVerse: "16",
        endVerse: "17",
      }),
    ).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 17,
    });
  });

  it("defaults endVerse to startVerse when omitted", () => {
    expect(
      validateMemoryPracticeSearch({
        book: "John",
        chapter: 3,
        startVerse: 16,
      }),
    ).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
  });

  it("clamps endVerse below startVerse up to startVerse", () => {
    expect(
      validateMemoryPracticeSearch({
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 10,
      }),
    ).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
  });
});

describe("hasPracticeVerseScope", () => {
  it("is true only for a complete scope", () => {
    expect(hasPracticeVerseScope({})).toBe(false);
    expect(
      hasPracticeVerseScope({
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
      }),
    ).toBe(true);
  });
});
