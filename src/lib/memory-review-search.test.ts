import { describe, expect, it } from "vitest";

import {
  hasReviewVerseScope,
  memoryReviewSearch,
  validateMemoryReviewSearch,
} from "./memory-review-search";

describe("validateMemoryReviewSearch", () => {
  it("normalizes a complete single-verse review scope", () => {
    expect(
      validateMemoryReviewSearch({
        book: " John ",
        chapter: "1",
        startVerse: "4",
      }),
    ).toEqual({
      book: "John",
      chapter: 1,
      startVerse: 4,
      endVerse: 4,
    });
  });

  it("returns empty for incomplete scopes", () => {
    expect(validateMemoryReviewSearch({ book: "John", chapter: 1 })).toEqual(
      {},
    );
  });
});

describe("hasReviewVerseScope", () => {
  it("detects complete review scopes", () => {
    expect(hasReviewVerseScope({})).toBe(false);
    expect(
      hasReviewVerseScope({
        book: "John",
        chapter: 1,
        startVerse: 4,
        endVerse: 4,
      }),
    ).toBe(true);
  });
});

describe("memoryReviewSearch", () => {
  it("serializes a verse reference into search params", () => {
    expect(
      memoryReviewSearch({
        book: "John",
        chapter: 1,
        startVerse: 28,
        endVerse: 34,
      }),
    ).toEqual({
      book: "John",
      chapter: 1,
      startVerse: 28,
      endVerse: 34,
    });
  });
});
