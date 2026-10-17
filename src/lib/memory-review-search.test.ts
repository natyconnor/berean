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

  it("keeps an allowed return with or without a verse scope", () => {
    expect(
      validateMemoryReviewSearch({ return: "/memory?panel=pack:abc" }),
    ).toEqual({ return: "/memory?panel=pack:abc" });
    expect(
      validateMemoryReviewSearch({
        book: "John",
        chapter: 1,
        startVerse: 4,
        return: "/memory/verses",
      }),
    ).toEqual({
      book: "John",
      chapter: 1,
      startVerse: 4,
      endVerse: 4,
      return: "/memory/verses",
    });
  });

  it("drops a return that leaves the app", () => {
    expect(
      validateMemoryReviewSearch({ return: "https://evil.com/memory" }),
    ).toEqual({});
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
