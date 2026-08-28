import { describe, expect, it } from "vitest";

import {
  packAllowsUnifiedRecitation,
  scopeChaptersAreContiguous,
  spansFormContiguousBlock,
} from "./contiguous-spans";
import type { VerseSpan } from "./hearted-verse-coverage";
import type { VerseScope } from "./verse-scope-match";

function psalm(
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): VerseSpan {
  return { book: "Psalms", chapter, startVerse, endVerse };
}

const PSALM_1: VerseScope = {
  books: ["Psalms"],
  chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 1 }],
};

describe("spansFormContiguousBlock", () => {
  it("accepts grouped units that fill a chapter without gaps", () => {
    expect(
      spansFormContiguousBlock([
        psalm(1, 1, 2),
        psalm(1, 3),
        psalm(1, 4),
        psalm(1, 5, 6),
      ]),
    ).toBe(true);
  });

  it("rejects a hole in the same chapter", () => {
    expect(spansFormContiguousBlock([psalm(1, 1, 2), psalm(1, 5, 6)])).toBe(
      false,
    );
  });

  it("accepts a mid-chapter run that does not start at verse 1", () => {
    expect(spansFormContiguousBlock([psalm(1, 3, 4)])).toBe(true);
  });

  it("walks across consecutive chapters at the verse boundary", () => {
    expect(spansFormContiguousBlock([psalm(1, 5, 6), psalm(2, 1, 2)])).toBe(
      true,
    );
  });

  it("rejects a skipped chapter", () => {
    expect(spansFormContiguousBlock([psalm(1, 1, 6), psalm(3, 1, 8)])).toBe(
      false,
    );
  });

  it("rejects a second book", () => {
    expect(
      spansFormContiguousBlock([
        psalm(1, 1, 6),
        { book: "John", chapter: 1, startVerse: 1, endVerse: 5 },
      ]),
    ).toBe(false);
  });

  it("rejects an empty set", () => {
    expect(spansFormContiguousBlock([])).toBe(false);
  });
});

describe("packAllowsUnifiedRecitation", () => {
  it("allows a contiguous member block even when the scope is larger", () => {
    expect(
      packAllowsUnifiedRecitation([psalm(1, 1, 2)], {
        books: ["Psalms"],
        chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 3 }],
      }),
    ).toBe(true);
  });

  it("allows a fully hearted contiguous scope", () => {
    expect(scopeChaptersAreContiguous(PSALM_1)).toBe(true);
    expect(packAllowsUnifiedRecitation([psalm(1, 1, 6)], PSALM_1)).toBe(true);
  });

  it("hides a gapped pack that is not the whole scope", () => {
    expect(
      packAllowsUnifiedRecitation([psalm(1, 1, 2), psalm(1, 5, 6)], PSALM_1),
    ).toBe(false);
  });
});
