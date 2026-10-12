import { describe, expect, it } from "vitest";

import type { VerseSpan } from "./hearted-verse-coverage";
import { MEMORIZE_MAX_PACK_SPANS } from "./memorize-status";
import {
  formatChapterSpanTitle,
  formatSpanTitle,
  memorizeTargetSpans,
  passageScope,
  resolveMemorizeTarget,
} from "./memorize-target";

function span(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): VerseSpan {
  return { book, chapter, startVerse, endVerse };
}

describe("resolveMemorizeTarget", () => {
  it("makes a chapter a passage", () => {
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Psalms",
        startChapter: 1,
        endChapter: 1,
      }),
    ).toEqual({
      mode: "passage",
      title: "Psalm 1",
      book: "Psalms",
      startChapter: 1,
      endChapter: 1,
      range: null,
      verseCount: 6,
    });
  });

  it("makes spans that cover a whole chapter a passage", () => {
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [span("Psalms", 1, 1, 6)],
    });
    expect(resolved).toMatchObject({
      mode: "passage",
      title: "Psalm 1",
      book: "Psalms",
      startChapter: 1,
      endChapter: 1,
      verseCount: 6,
    });
  });

  it("joins split spans that together cover whole chapters", () => {
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [
        span("Psalms", 2, 1, 12),
        span("Psalms", 1, 4, 6),
        span("Psalms", 1, 1, 3),
      ],
    });
    expect(resolved).toMatchObject({
      mode: "passage",
      title: "Psalm 1\u20132",
      startChapter: 1,
      endChapter: 2,
      verseCount: 18,
    });
  });

  it("makes one verse a verse card", () => {
    expect(
      resolveMemorizeTarget({ kind: "spans", spans: [span("Romans", 8, 28)] }),
    ).toEqual({
      mode: "verse",
      title: "Romans 8:28",
      span: span("Romans", 8, 28),
      verseCount: 1,
    });
  });

  it("keeps up to three verses as one card", () => {
    expect(
      resolveMemorizeTarget({
        kind: "spans",
        spans: [span("Romans", 8, 28, 30)],
      }),
    ).toEqual({
      mode: "verse",
      title: "Romans 8:28\u201330",
      span: span("Romans", 8, 28, 30),
      verseCount: 3,
    });
  });

  it("makes a partial range of more than three verses a pack of single verses", () => {
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [span("Philippians", 2, 1, 11)],
    });
    expect(resolved.mode).toBe("pack");
    if (resolved.mode !== "pack") return;
    expect(resolved.title).toBe("Philippians 2:1\u201311");
    expect(resolved.verseCount).toBe(11);
    expect(resolved.spans).toHaveLength(11);
    expect(resolved.spans[0]).toEqual(span("Philippians", 2, 1));
    expect(resolved.spans[10]).toEqual(span("Philippians", 2, 11));
  });

  it("names a chapter range by reference", () => {
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Matthew",
        startChapter: 5,
        endChapter: 7,
      }),
    ).toMatchObject({
      mode: "passage",
      title: "Matthew 5\u20137",
      startChapter: 5,
      endChapter: 7,
      verseCount: 48 + 34 + 29,
    });
  });

  it("names a preset passage after its preset", () => {
    const resolved = resolveMemorizeTarget({
      kind: "chapters",
      book: "Matthew",
      startChapter: 5,
      endChapter: 7,
      presetId: "matthew-5-7",
    });
    expect(resolved).toMatchObject({
      mode: "passage",
      title: "Sermon on the Mount",
      presetId: "matthew-5-7",
    });
  });

  it("prefers an explicit title", () => {
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Matthew",
        startChapter: 5,
        endChapter: 7,
        presetId: "matthew-5-7",
        title: "The Beatitudes and more",
      }).title,
    ).toBe("The Beatitudes and more");
    expect(
      resolveMemorizeTarget({
        kind: "spans",
        spans: [span("Romans", 8, 28), span("John", 3, 16)],
        title: "Verses for the Merced team",
      }).title,
    ).toBe("Verses for the Merced team");
  });

  it("rejects more than 20 chapters as too long", () => {
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Romans",
        startChapter: 1,
        endChapter: 21,
      }),
    ).toEqual({
      mode: "invalid",
      title: "Romans 1\u201321",
      reason: "tooLong",
    });
  });

  it("allows exactly 20 chapters", () => {
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Psalms",
        startChapter: 1,
        endChapter: 20,
      }).mode,
    ).toBe("passage");
  });

  it("makes several spans a pack in the order given", () => {
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [span("Romans", 8, 28), span("John", 3, 16)],
    });
    expect(resolved).toEqual({
      mode: "pack",
      title: "2 verses",
      spans: [span("Romans", 8, 28), span("John", 3, 16)],
      verseCount: 2,
    });
  });

  it("counts every verse of multi-verse spans and drops repeats", () => {
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [
        span("Joshua", 1, 7, 9),
        span("Romans", 8, 28),
        span("Joshua", 1, 7, 9),
      ],
    });
    expect(resolved).toEqual({
      mode: "pack",
      title: "4 verses",
      spans: [span("Joshua", 1, 7, 9), span("Romans", 8, 28)],
      verseCount: 4,
    });
  });

  it("makes whole chapters with a gap a pack", () => {
    expect(
      resolveMemorizeTarget({
        kind: "spans",
        spans: [span("Psalms", 1, 1, 6), span("Psalms", 3, 1, 8)],
      }).mode,
    ).toBe("pack");
  });

  it("rejects whole chapters across books", () => {
    expect(
      resolveMemorizeTarget({
        kind: "spans",
        spans: [span("Ruth", 4, 1, 22), span("1 Samuel", 1, 1, 28)],
      }),
    ).toEqual({
      mode: "invalid",
      title: "Ruth 4, 1 Samuel 1",
      reason: "crossBook",
    });
  });

  it("rejects empty and out-of-range targets", () => {
    expect(resolveMemorizeTarget({ kind: "spans", spans: [] })).toMatchObject({
      mode: "invalid",
      reason: "empty",
    });
    expect(
      resolveMemorizeTarget({ kind: "spans", spans: [span("Psalms", 1, 7)] }),
    ).toMatchObject({ mode: "invalid", reason: "empty" });
    expect(
      resolveMemorizeTarget({
        kind: "spans",
        spans: [span("Psalms", 1, 3, 2)],
      }),
    ).toMatchObject({ mode: "invalid", reason: "empty" });
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Jude",
        startChapter: 1,
        endChapter: 2,
      }),
    ).toMatchObject({ mode: "invalid", reason: "empty" });
    expect(
      resolveMemorizeTarget({
        kind: "chapters",
        book: "Psalms",
        startChapter: 3,
        endChapter: 2,
      }),
    ).toMatchObject({ mode: "invalid", reason: "empty" });
  });

  it("rejects packs over the span cap as too long", () => {
    const spans = Array.from({ length: MEMORIZE_MAX_PACK_SPANS + 1 }, (_, i) =>
      span("Psalms", (i % 150) + 1, Math.floor(i / 150) + 1),
    );
    expect(resolveMemorizeTarget({ kind: "spans", spans })).toMatchObject({
      mode: "invalid",
      reason: "tooLong",
    });
  });

  it("uses the injected verse counts", () => {
    const resolved = resolveMemorizeTarget(
      { kind: "chapters", book: "Psalms", startChapter: 1, endChapter: 1 },
      { chapterVerseCount: () => 4 },
    );
    expect(resolved).toMatchObject({ mode: "passage", verseCount: 4 });
  });
});

describe("memorizeTargetSpans", () => {
  it("lists what each mode memorizes", () => {
    expect(
      memorizeTargetSpans(
        resolveMemorizeTarget({
          kind: "chapters",
          book: "Matthew",
          startChapter: 5,
          endChapter: 7,
        }),
      ),
    ).toEqual([
      span("Matthew", 5, 1, 48),
      span("Matthew", 6, 1, 34),
      span("Matthew", 7, 1, 29),
    ]);
    expect(
      memorizeTargetSpans(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Romans", 8, 28)],
        }),
      ),
    ).toEqual([span("Romans", 8, 28)]);
    expect(
      memorizeTargetSpans(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Philippians", 2, 1, 4)],
        }),
      ),
    ).toEqual([
      span("Philippians", 2, 1),
      span("Philippians", 2, 2),
      span("Philippians", 2, 3),
      span("Philippians", 2, 4),
    ]);
    expect(
      memorizeTargetSpans(
        resolveMemorizeTarget({
          kind: "chapters",
          book: "Romans",
          startChapter: 1,
          endChapter: 21,
        }),
      ),
    ).toEqual([]);
  });
});

describe("titles and scope", () => {
  it("formats chapter and verse titles with an en dash", () => {
    expect(formatChapterSpanTitle("Psalms", 23, 23)).toBe("Psalm 23");
    expect(formatChapterSpanTitle("John", 14, 17)).toBe("John 14\u201317");
    expect(formatSpanTitle(span("John", 3, 16))).toBe("John 3:16");
    expect(formatSpanTitle(span("Psalms", 46, 1, 3))).toBe("Psalm 46:1\u20133");
  });

  it("builds the scope a passage pack is stored under", () => {
    expect(passageScope("Matthew", 5, 7)).toEqual({
      books: ["Matthew"],
      chapterRanges: [{ book: "Matthew", startChapter: 5, endChapter: 7 }],
      tags: [],
      tagMatchMode: "any",
    });
  });
});
