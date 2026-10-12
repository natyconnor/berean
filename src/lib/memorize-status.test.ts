import { describe, expect, it } from "vitest";

import type { VerseSpan } from "./hearted-verse-coverage";
import { passageCoverage, sameSpanSet, uniqueSpans } from "./memorize-status";

function span(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): VerseSpan {
  return { book, chapter, startVerse, endVerse };
}

const matthew5to7 = [
  span("Matthew", 5, 1, 48),
  span("Matthew", 6, 1, 34),
  span("Matthew", 7, 1, 29),
];

describe("passageCoverage", () => {
  it("is equal when the target covers the same chapters", () => {
    expect(passageCoverage(matthew5to7, matthew5to7)).toBe("equal");
    expect(
      passageCoverage([span("Psalms", 1, 1, 6)], [span("Psalms", 1, 1, 6)]),
    ).toBe("equal");
  });

  it("contains a verse or a smaller part of the passage", () => {
    expect(passageCoverage([span("Matthew", 6, 9, 13)], matthew5to7)).toBe(
      "contains",
    );
    expect(passageCoverage([matthew5to7[0]], matthew5to7)).toBe("contains");
  });

  it("is null when any of the target is outside the passage", () => {
    expect(
      passageCoverage(
        [span("Matthew", 6, 9), span("Matthew", 8, 1)],
        matthew5to7,
      ),
    ).toBeNull();
    expect(
      passageCoverage([span("Psalms", 1, 1, 6)], [span("Psalms", 1, 1, 5)]),
    ).toBeNull();
    expect(passageCoverage([], matthew5to7)).toBeNull();
    expect(passageCoverage(matthew5to7, [])).toBeNull();
  });
});

describe("uniqueSpans", () => {
  it("drops exact repeats and keeps first-seen order", () => {
    expect(
      uniqueSpans([
        span("John", 3, 16),
        span("Romans", 8, 28),
        span("John", 3, 16),
        span("John", 3, 16, 17),
      ]),
    ).toEqual([
      span("John", 3, 16),
      span("Romans", 8, 28),
      span("John", 3, 16, 17),
    ]);
  });
});

describe("sameSpanSet", () => {
  it("ignores order and repeats", () => {
    expect(
      sameSpanSet(
        [span("Romans", 8, 28), span("John", 3, 16)],
        [span("John", 3, 16), span("Romans", 8, 28), span("John", 3, 16)],
      ),
    ).toBe(true);
  });

  it("is false when either side has a span the other lacks", () => {
    expect(
      sameSpanSet([span("Romans", 8, 28)], [span("Romans", 8, 28, 29)]),
    ).toBe(false);
    expect(
      sameSpanSet(
        [span("Romans", 8, 28)],
        [span("Romans", 8, 28), span("John", 3, 16)],
      ),
    ).toBe(false);
  });
});
