import { describe, expect, it } from "vitest";
import {
  buildVerseSuggestions,
  formatBookChapter,
  formatVerseRef,
  isChapterScopeRef,
  parseVerseRef,
  resolveCanonicalBookName,
  resolveExtraBookAliases,
  searchBibleBooks,
  unionVerseRefs,
  formatVerseRange,
  verseRefsHaveMixedRanges,
} from "./verse-ref-utils";

describe("parseVerseRef", () => {
  it("understands common short book names", () => {
    expect(parseVerseRef("Jn 3:16")).toMatchObject({ book: "John" });
    expect(parseVerseRef("1 Jn 4:8")).toMatchObject({ book: "1 John" });
    expect(parseVerseRef("Mt 6:33")).toMatchObject({ book: "Matthew" });
    expect(parseVerseRef("Mk 1:15")).toMatchObject({ book: "Mark" });
    expect(parseVerseRef("Lk 9:23")).toMatchObject({ book: "Luke" });
  });

  it("parses single verses and ranges", () => {
    expect(parseVerseRef("John 3:16")).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
    expect(parseVerseRef("Romans 8:28-30")).toEqual({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 30,
    });
  });

  it("rejects chapter-only input by default", () => {
    expect(parseVerseRef("John 3")).toBeNull();
  });

  it("parses chapter-only input when allowChapterOnly is enabled", () => {
    expect(parseVerseRef("John 3", { allowChapterOnly: true })).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
  });

  it("rejects invalid chapters even with allowChapterOnly", () => {
    expect(parseVerseRef("John 99", { allowChapterOnly: true })).toBeNull();
  });

  it("reads Book N as a verse in chapter 1 for single-chapter books", () => {
    expect(parseVerseRef("Jude 2")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 2,
      endVerse: 2,
    });
    expect(parseVerseRef("3 John 2")).toEqual({
      book: "3 John",
      chapter: 1,
      startVerse: 2,
      endVerse: 2,
    });
    expect(parseVerseRef("Philemon 4")).toEqual({
      book: "Philemon",
      chapter: 1,
      startVerse: 4,
      endVerse: 4,
    });
    expect(parseVerseRef("Obadiah 3")).toEqual({
      book: "Obadiah",
      chapter: 1,
      startVerse: 3,
      endVerse: 3,
    });
    expect(parseVerseRef("2 John 5")).toEqual({
      book: "2 John",
      chapter: 1,
      startVerse: 5,
      endVerse: 5,
    });
  });

  it("reads Book N-M as a verse range in chapter 1 for single-chapter books", () => {
    expect(parseVerseRef("Jude 1-3")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 3,
    });
    expect(parseVerseRef("Jude 2-3")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 2,
      endVerse: 3,
    });
    expect(parseVerseRef("Jude 3-5")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 3,
      endVerse: 5,
    });
    expect(parseVerseRef("Jude 10-12")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 10,
      endVerse: 12,
    });
    expect(parseVerseRef("2 John 2-4")).toEqual({
      book: "2 John",
      chapter: 1,
      startVerse: 2,
      endVerse: 4,
    });
  });

  it("still parses explicit chapter:verse form in single-chapter books", () => {
    expect(parseVerseRef("Jude 1:2")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 2,
      endVerse: 2,
    });
    expect(parseVerseRef("3 John 1:2")).toEqual({
      book: "3 John",
      chapter: 1,
      startVerse: 2,
      endVerse: 2,
    });
    expect(parseVerseRef("Philemon 1:4")).toEqual({
      book: "Philemon",
      chapter: 1,
      startVerse: 4,
      endVerse: 4,
    });
  });

  it("reads Book 1 as verse 1 in single-chapter books", () => {
    expect(parseVerseRef("Jude 1")).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    });
    expect(parseVerseRef("Jude 1", { allowChapterOnly: true })).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    });
    expect(parseVerseRef("2 John 1", { allowChapterOnly: true })).toEqual({
      book: "2 John",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    });
  });

  it("reads an exact single-chapter book name as a chapter link when allowChapterOnly is set", () => {
    expect(parseVerseRef("Jude")).toBeNull();
    expect(parseVerseRef("Jude", { allowChapterOnly: true })).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
    expect(parseVerseRef("Phlm", { allowChapterOnly: true })).toEqual({
      book: "Philemon",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
    expect(parseVerseRef("2 John", { allowChapterOnly: true })).toEqual({
      book: "2 John",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
    expect(parseVerseRef("3 John", { allowChapterOnly: true })).toEqual({
      book: "3 John",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
    expect(parseVerseRef("Obadiah", { allowChapterOnly: true })).toEqual({
      book: "Obadiah",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
    expect(parseVerseRef("Ju", { allowChapterOnly: true })).toBeNull();
    expect(parseVerseRef("John", { allowChapterOnly: true })).toBeNull();
  });

  it("leaves multi-chapter Book N and Book N-M behavior unchanged", () => {
    expect(parseVerseRef("John 3:16")).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
    expect(parseVerseRef("John 3")).toBeNull();
    expect(parseVerseRef("John 3", { allowChapterOnly: true })).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
    expect(parseVerseRef("John 3-5")).toBeNull();
    expect(parseVerseRef("John 3-5", { allowChapterOnly: true })).toBeNull();
  });

  it("keeps compact @3 as a verse in the current chapter", () => {
    expect(
      parseVerseRef("3", {
        defaultBook: "John",
        defaultChapter: 3,
        allowChapterOnly: true,
      }),
    ).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 3,
      endVerse: 3,
    });
  });

  it("still prefers verse syntax when a colon is present", () => {
    expect(parseVerseRef("John 3:16", { allowChapterOnly: true })).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
  });
});

describe("buildVerseSuggestions", () => {
  it("offers a verse-link suggestion for Jude 2", () => {
    const suggestion = buildVerseSuggestions("Jude 2").find(
      (item) => item.kind === "reference",
    );
    expect(suggestion?.label).toBe("Jude 1:2");
    expect(suggestion?.ref).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 2,
      endVerse: 2,
    });
  });

  it("offers a verse-link suggestion for Jude 1", () => {
    const suggestion = buildVerseSuggestions("Jude 1", {
      allowChapterOnly: true,
    }).find((item) => item.kind === "reference");
    expect(suggestion?.label).toBe("Jude 1:1");
    expect(suggestion?.ref).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    });
  });

  it("labels an exact Jude chapter suggestion with the book name", () => {
    const suggestion = buildVerseSuggestions("Jude", {
      allowChapterOnly: true,
    }).find((item) => item.kind === "reference");
    expect(suggestion?.label).toBe("Jude");
    expect(suggestion?.ref).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
  });
  it.each([
    "Jude 0-3",
    "Jude 3-0",
    "Jude 1:0",
    "John 3:0",
    "John 3:0-4",
    "John 3:4-0",
    "Jude 5-3",
    "John 3:5-3",
  ])("does not offer a verse-link suggestion for %s", (query) => {
    const suggestion = buildVerseSuggestions(query, {
      allowChapterOnly: true,
    }).find((item) => item.kind === "reference");
    expect(suggestion).toBeUndefined();
  });
});

describe("formatVerseRef", () => {
  it("formats chapter-scoped refs without a verse", () => {
    expect(
      formatVerseRef({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe("John 3");
  });

  it.each([
    ["Jude", "Jude"],
    ["Philemon", "Philemon"],
    ["Obadiah", "Obadiah"],
    ["2 John", "2 John"],
    ["3 John", "3 John"],
  ])("labels a chapter-scope %s link with the book name", (book, label) => {
    expect(
      formatVerseRef({
        book,
        chapter: 1,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe(label);
  });

  it("formats verse and range refs unchanged", () => {
    expect(
      formatVerseRef({
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
      }),
    ).toBe("John 3:16");
    expect(
      formatVerseRef({
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 18,
      }),
    ).toBe("John 3:16-18");
  });

  it("uses Psalm for a specific psalm chapter or verse", () => {
    expect(formatBookChapter("Psalms", 1)).toBe("Psalm 1");
    expect(
      formatVerseRef({
        book: "Psalms",
        chapter: 1,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe("Psalm 1");
    expect(
      formatVerseRef({
        book: "Psalms",
        chapter: 23,
        startVerse: 1,
        endVerse: 1,
      }),
    ).toBe("Psalm 23:1");
    expect(
      formatVerseRef({
        book: "Psalms",
        chapter: 119,
        startVerse: 1,
        endVerse: 16,
      }),
    ).toBe("Psalm 119:1-16");
  });
});

describe("formatBookChapter", () => {
  it("labels a whole one-chapter book with the book name only", () => {
    expect(formatBookChapter("Jude", 1)).toBe("Jude");
    expect(formatBookChapter("Obadiah", 1)).toBe("Obadiah");
    expect(formatBookChapter("Philemon", 1)).toBe("Philemon");
    expect(formatBookChapter("2 John", 1)).toBe("2 John");
    expect(formatBookChapter("3 John", 1)).toBe("3 John");
  });

  it("keeps multi-chapter book labels as book plus chapter", () => {
    expect(formatBookChapter("John", 3)).toBe("John 3");
  });
});

describe("unionVerseRefs", () => {
  it("returns null for an empty list", () => {
    expect(unionVerseRefs([])).toBeNull();
  });

  it("returns a copy of a single ref", () => {
    expect(
      unionVerseRefs([
        { book: "2 Samuel", chapter: 23, startVerse: 9, endVerse: 11 },
      ]),
    ).toEqual({
      book: "2 Samuel",
      chapter: 23,
      startVerse: 9,
      endVerse: 11,
    });
  });

  it("unions overlapping ranges that share a start verse", () => {
    expect(
      unionVerseRefs([
        { book: "2 Samuel", chapter: 23, startVerse: 9, endVerse: 11 },
        { book: "2 Samuel", chapter: 23, startVerse: 9, endVerse: 12 },
      ]),
    ).toEqual({
      book: "2 Samuel",
      chapter: 23,
      startVerse: 9,
      endVerse: 12,
    });
  });
});

describe("formatVerseRange", () => {
  it("formats a single verse and a span", () => {
    expect(formatVerseRange({ startVerse: 9, endVerse: 9 })).toBe("9");
    expect(formatVerseRange({ startVerse: 7, endVerse: 8 })).toBe("7-8");
  });
});

describe("verseRefsHaveMixedRanges", () => {
  const john17 = {
    book: "John",
    chapter: 1,
    startVerse: 7,
    endVerse: 9,
  };

  it("is false for one ref or identical ranges", () => {
    expect(verseRefsHaveMixedRanges([john17])).toBe(false);
    expect(
      verseRefsHaveMixedRanges([
        john17,
        { ...john17, startVerse: 7, endVerse: 9 },
      ]),
    ).toBe(false);
  });

  it("is true when end verses differ", () => {
    expect(
      verseRefsHaveMixedRanges([
        john17,
        { ...john17, startVerse: 7, endVerse: 8 },
      ]),
    ).toBe(true);
  });
});

describe("isChapterScopeRef", () => {
  it("detects chapter scope", () => {
    expect(
      isChapterScopeRef({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      }),
    ).toBe(true);
    expect(
      isChapterScopeRef({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
      }),
    ).toBe(false);
  });
});

const SONG_OF_SOLOMON_ALIASES = [
  "Song of Songs",
  "Songs",
  "SOS",
  "Canticles",
] as const;

const SONG_OF_SOLOMON_2_4 = {
  book: "Song of Solomon",
  chapter: 2,
  startVerse: 4,
  endVerse: 4,
};

describe("Song of Solomon aliases", () => {
  it.each(SONG_OF_SOLOMON_ALIASES)(
    'parseVerseRef("%s 2:4") is Song of Solomon 2:4',
    (alias) => {
      expect(parseVerseRef(`${alias} 2:4`)).toEqual(SONG_OF_SOLOMON_2_4);
    },
  );

  it('parseVerseRef("Canticles 2") is Song of Solomon chapter 2', () => {
    expect(parseVerseRef("Canticles 2", { allowChapterOnly: true })).toEqual({
      book: "Song of Solomon",
      chapter: 2,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
  });

  it.each(SONG_OF_SOLOMON_ALIASES)(
    "resolveCanonicalBookName(%s) is Song of Solomon",
    (alias) => {
      expect(resolveCanonicalBookName(alias)).toBe("Song of Solomon");
    },
  );

  it.each(SONG_OF_SOLOMON_ALIASES)(
    "searchBibleBooks(%s) includes Song of Solomon",
    (alias) => {
      expect(searchBibleBooks(alias).map((match) => match.name)).toContain(
        "Song of Solomon",
      );
    },
  );
});

describe("resolveExtraBookAliases", () => {
  it("resolves space-stripped and spaced keys to the canonical book", () => {
    expect(
      resolveExtraBookAliases({
        "1John": ["1 Jn"],
        "Song of Solomon": ["SOS"],
      }),
    ).toEqual(
      new Map([
        ["1 John", ["1 Jn"]],
        ["Song of Solomon", ["SOS"]],
      ]),
    );
  });
});

describe("existing book aliases", () => {
  it.each([
    [
      "Song of Solomon 2:4",
      {
        book: "Song of Solomon",
        chapter: 2,
        startVerse: 4,
        endVerse: 4,
      },
    ],
    [
      "Song 2:4",
      {
        book: "Song of Solomon",
        chapter: 2,
        startVerse: 4,
        endVerse: 4,
      },
    ],
    [
      "Revelations 1:1",
      { book: "Revelation", chapter: 1, startVerse: 1, endVerse: 1 },
    ],
  ] as const)("parseVerseRef(%s) still resolves", (input, expected) => {
    expect(parseVerseRef(input)).toEqual(expected);
  });
});
