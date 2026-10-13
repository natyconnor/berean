import { describe, expect, it } from "vitest";

import { getChapterVerseCount } from "./bible-verse-counts";
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

  describe("the auto-passage rule", () => {
    it.each([
      ["Philippians 2:1\u201311", [span("Philippians", 2, 1, 11)], 11],
      ["Matthew 6:9\u201313", [span("Matthew", 6, 9, 13)], 5],
      ["Romans 8:28\u201339", [span("Romans", 8, 28, 39)], 12],
      [
        "Romans 7:24\u20138:2",
        [span("Romans", 7, 24, 25), span("Romans", 8, 1, 2)],
        4,
      ],
    ])("makes %s a passage", (title, spans, verseCount) => {
      const resolved = resolveMemorizeTarget({ kind: "spans", spans });
      expect(resolved).toMatchObject({ mode: "passage", title, verseCount });
    });

    it("keeps the passage's verse bounds and covering chapters", () => {
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Romans", 8, 1, 2), span("Romans", 7, 24, 25)],
        }),
      ).toEqual({
        mode: "passage",
        title: "Romans 7:24\u20138:2",
        book: "Romans",
        startChapter: 7,
        endChapter: 8,
        range: {
          book: "Romans",
          startChapter: 7,
          startVerse: 24,
          endChapter: 8,
          endVerse: 2,
        },
        verseCount: 4,
      });
    });

    it("keeps John 3:16 one verse card", () => {
      expect(
        resolveMemorizeTarget({ kind: "spans", spans: [span("John", 3, 16)] })
          .mode,
      ).toBe("verse");
    });

    it("makes Psalm 117, a whole chapter of two verses, one verse card", () => {
      const expected = {
        mode: "verse",
        title: "Psalm 117",
        span: span("Psalms", 117, 1, 2),
        verseCount: 2,
      };
      expect(
        resolveMemorizeTarget({
          kind: "chapters",
          book: "Psalms",
          startChapter: 117,
          endChapter: 117,
        }),
      ).toEqual(expected);
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Psalms", 117, 1, 2)],
        }),
      ).toEqual(expected);
    });

    it("leaves the single-piece check to the start path", () => {
      // Four short verses may group into one piece; only their text can tell
      // (see planPassagePieces).
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Psalms", 133, 3), span("Psalms", 134, 1, 3)],
        }),
      ).toMatchObject({
        mode: "passage",
        title: "Psalm 133:3\u2013134:3",
        verseCount: 4,
      });
    });

    it("joins adjacent spans into one passage", () => {
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Philippians", 2, 5, 11), span("Philippians", 2, 1, 4)],
        }),
      ).toMatchObject({
        mode: "passage",
        title: "Philippians 2:1\u201311",
        range: { startChapter: 2, startVerse: 1, endChapter: 2, endVerse: 11 },
      });
    });

    it("makes spans with a gap a pack", () => {
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Philippians", 2, 1, 4), span("Philippians", 2, 6, 11)],
        }).mode,
      ).toBe("pack");
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Romans", 7, 24, 24), span("Romans", 8, 1, 2)],
        }).mode,
      ).toBe("pack");
    });

    it("makes a run into a whole chapter a passage with a range", () => {
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Romans", 7, 24, 25), span("Romans", 8, 1, 39)],
        }),
      ).toMatchObject({
        mode: "passage",
        title: "Romans 7:24\u20138:39",
        range: { startChapter: 7, startVerse: 24, endChapter: 8, endVerse: 39 },
        verseCount: 41,
      });
    });

    it("rejects a run over more than 20 chapters as too long", () => {
      const spans = [span("Psalms", 1, 3, 6)];
      for (let chapter = 2; chapter <= 21; chapter += 1) {
        spans.push(
          span(
            "Psalms",
            chapter,
            1,
            getChapterVerseCount("Psalms", chapter) ?? 0,
          ),
        );
      }
      spans.push(span("Psalms", 22, 1));
      expect(resolveMemorizeTarget({ kind: "spans", spans })).toMatchObject({
        mode: "invalid",
        reason: "tooLong",
      });
    });

    it("names a range preset after its preset", () => {
      expect(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Philippians", 2, 5, 11)],
          presetId: "philippians-2-5-11",
        }),
      ).toMatchObject({
        mode: "passage",
        title: "The Christ Hymn",
        presetId: "philippians-2-5-11",
        verseCount: 7,
      });
    });
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
    ).toEqual([span("Philippians", 2, 1, 4)]);
    expect(
      memorizeTargetSpans(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Romans", 7, 24, 25), span("Romans", 8, 1, 2)],
        }),
      ),
    ).toEqual([span("Romans", 7, 24, 25), span("Romans", 8, 1, 2)]);
    expect(
      memorizeTargetSpans(
        resolveMemorizeTarget({
          kind: "spans",
          spans: [span("Romans", 8, 28), span("Romans", 8, 30)],
        }),
      ),
    ).toEqual([span("Romans", 8, 28), span("Romans", 8, 30)]);
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
