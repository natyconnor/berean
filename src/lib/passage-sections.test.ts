import { describe, expect, it } from "vitest";

import type { PassagePieceBase } from "./passage-pieces";
import {
  applyLearningSections,
  MAX_SECTION_VERSES,
  MIN_SECTION_VERSES,
  packLearningSectionGroups,
  pieceVerseCount,
  sectionVerseCount,
} from "./passage-sections";

function piece(
  index: number,
  startVerse: number,
  endVerse = startVerse,
  extra?: Partial<PassagePieceBase>,
): PassagePieceBase {
  return {
    index,
    book: extra?.book ?? "Psalms",
    chapter: extra?.chapter ?? 16,
    startVerse,
    endVerse,
    sectionIndex: extra?.sectionIndex ?? 0,
    ...extra,
  };
}

function ones(
  count: number,
  extra?: Partial<PassagePieceBase>,
): PassagePieceBase[] {
  return Array.from({ length: count }, (_, index) =>
    piece(index, index + 1, index + 1, extra),
  );
}

describe("packLearningSectionGroups", () => {
  it("keeps eight or nine verses as one section", () => {
    expect(
      packLearningSectionGroups(Array.from({ length: 8 }, () => 1)),
    ).toEqual([[0, 1, 2, 3, 4, 5, 6, 7]]);
    expect(
      packLearningSectionGroups(Array.from({ length: 9 }, () => 1)),
    ).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8]]);
  });

  it("splits ten and eleven verses instead of leaving a stub", () => {
    expect(
      packLearningSectionGroups(Array.from({ length: 10 }, () => 1)),
    ).toEqual([
      [0, 1, 2, 3, 4],
      [5, 6, 7, 8, 9],
    ]);
    const eleven = packLearningSectionGroups(
      Array.from({ length: 11 }, () => 1),
    );
    const sizes = eleven.map((group) => group.length);
    expect(sizes).toHaveLength(2);
    expect(sizes.every((size) => size >= MIN_SECTION_VERSES)).toBe(true);
    expect(sizes.every((size) => size <= MAX_SECTION_VERSES)).toBe(true);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(11);
  });

  it("packs a 25-verse chapter into 5–8 verse sections", () => {
    const groups = packLearningSectionGroups(
      Array.from({ length: 25 }, () => 1),
    );
    const sizes = groups.map((group) => group.length);
    expect(sizes.every((size) => size >= MIN_SECTION_VERSES)).toBe(true);
    expect(sizes.every((size) => size <= MAX_SECTION_VERSES)).toBe(true);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(25);
  });

  it("prefers a 4+7 split over 8+3 when pieces cannot hit 5–8 twice", () => {
    expect(packLearningSectionGroups([4, 4, 3])).toEqual([[0], [1, 2]]);
  });
});

describe("applyLearningSections", () => {
  it("packs Psalm 16 into two neighbor-sized sections and labels the ranges", () => {
    const packed = applyLearningSections(ones(11));
    const first = packed.filter((item) => item.sectionIndex === 0);
    const second = packed.filter((item) => item.sectionIndex === 1);
    expect(sectionVerseCount(first)).toBeGreaterThanOrEqual(MIN_SECTION_VERSES);
    expect(sectionVerseCount(second)).toBeGreaterThanOrEqual(
      MIN_SECTION_VERSES,
    );
    expect(sectionVerseCount(first)).toBeLessThanOrEqual(MAX_SECTION_VERSES);
    expect(sectionVerseCount(second)).toBeLessThanOrEqual(MAX_SECTION_VERSES);
    expect(first[0]?.sectionLabel).toMatch(/^Psalm 16:\d+-\d+$/);
    expect(second[0]?.sectionLabel).toMatch(/^Psalm 16:\d+-\d+$/);
    expect(
      first.slice(1).every((item) => item.sectionLabel === undefined),
    ).toBe(true);
  });

  it("labels a whole-chapter section with the book and chapter, not a heading", () => {
    const packed = applyLearningSections(ones(6, { book: "John", chapter: 3 }));
    expect(packed.every((item) => item.sectionIndex === 0)).toBe(true);
    expect(packed[0]?.sectionLabel).toBe("John 3");
  });

  it("still starts a new section when the chapter changes", () => {
    const packed = applyLearningSections([
      piece(0, 1, 1, { book: "John", chapter: 3 }),
      piece(1, 1, 1, { book: "John", chapter: 4 }),
    ]);
    expect(packed[0]?.sectionIndex).toBe(0);
    expect(packed[0]?.sectionLabel).toBe("John 3");
    expect(packed[1]?.sectionIndex).toBe(1);
    expect(packed[1]?.sectionLabel).toBe("John 4");
  });

  it("does not open a section on an ESV heading sitting mid-chapter", () => {
    const packed = applyLearningSections([
      piece(0, 1, 2, { book: "John", chapter: 3 }),
      piece(1, 3, 3, { book: "John", chapter: 3 }),
      piece(2, 4, 5, { book: "John", chapter: 3 }),
      piece(3, 6, 6, { book: "John", chapter: 3 }),
    ]);
    expect(packed.every((item) => item.sectionIndex === 0)).toBe(true);
    expect(sectionVerseCount(packed)).toBe(6);
    expect(packed[0]?.sectionLabel).toBe("John 3");
  });
});

describe("applyLearningSections with a passage range", () => {
  function rangePieces(
    book: string,
    spans: readonly [chapter: number, startVerse: number, endVerse: number][],
  ): PassagePieceBase[] {
    return spans.map(([chapter, startVerse, endVerse], index) =>
      piece(index, startVerse, endVerse, { book, chapter }),
    );
  }
  const labels = (pieces: PassagePieceBase[]) =>
    pieces.flatMap((item) => (item.sectionLabel ? [item.sectionLabel] : []));

  it("labels part of a chapter by its verses, not the chapter", () => {
    const christHymn = rangePieces("Philippians", [
      [2, 5, 6],
      [2, 7, 8],
      [2, 9, 11],
    ]);
    expect(labels(applyLearningSections(christHymn))).toEqual([
      "Philippians 2",
    ]);
    expect(
      labels(
        applyLearningSections(christHymn, {
          book: "Philippians",
          startChapter: 2,
          startVerse: 5,
          endChapter: 2,
          endVerse: 11,
        }),
      ),
    ).toEqual(["Philippians 2:5-11"]);
  });

  it("labels Philippians 2:1–11 sections as verse ranges", () => {
    const packed = applyLearningSections(
      rangePieces("Philippians", [
        [2, 1, 2],
        [2, 3, 4],
        [2, 5, 6],
        [2, 7, 8],
        [2, 9, 11],
      ]),
      {
        book: "Philippians",
        startChapter: 2,
        startVerse: 1,
        endChapter: 2,
        endVerse: 11,
      },
    );
    expect(labels(packed)).toEqual(["Philippians 2:1-6", "Philippians 2:7-11"]);
  });

  it("joins the short edges of Romans 7:24–8:2 into one section", () => {
    const packed = applyLearningSections(
      rangePieces("Romans", [
        [7, 24, 25],
        [8, 1, 2],
      ]),
      {
        book: "Romans",
        startChapter: 7,
        startVerse: 24,
        endChapter: 8,
        endVerse: 2,
      },
    );
    expect(packed.map((item) => item.sectionIndex)).toEqual([0, 0]);
    expect(labels(packed)).toEqual(["Romans 7:24-8:2"]);
  });

  it("joins a short opening edge to the next chapter's first section", () => {
    const packed = applyLearningSections(
      rangePieces("Romans", [
        [7, 24, 25],
        [8, 1, 4],
        [8, 5, 8],
        [8, 9, 11],
        [8, 12, 14],
        [8, 15, 17],
      ]),
      {
        book: "Romans",
        startChapter: 7,
        startVerse: 24,
        endChapter: 8,
        endVerse: 17,
      },
    );
    expect(packed[0]?.sectionIndex).toBe(packed[1]?.sectionIndex);
    expect(labels(packed)).toEqual(["Romans 7:24-8:8", "Romans 8:9-17"]);
  });

  it("joins a short closing edge to the previous chapter's last section", () => {
    const packed = applyLearningSections(
      rangePieces("Romans", [
        [8, 28, 30],
        [8, 31, 33],
        [8, 34, 36],
        [8, 37, 39],
        [9, 1, 2],
      ]),
      {
        book: "Romans",
        startChapter: 8,
        startVerse: 28,
        endChapter: 9,
        endVerse: 2,
      },
    );
    const last = packed[packed.length - 1];
    const beforeLast = packed[packed.length - 2];
    expect(last?.sectionIndex).toBe(beforeLast?.sectionIndex);
    expect(labels(packed).at(-1)).toMatch(/^Romans 8:\d+-9:2$/);
  });

  it("keeps an edge of five or more verses as its own section", () => {
    const packed = applyLearningSections(
      rangePieces("Romans", [
        [7, 21, 22],
        [7, 23, 25],
        [8, 1, 2],
        [8, 3, 4],
        [8, 5, 5],
      ]),
      {
        book: "Romans",
        startChapter: 7,
        startVerse: 21,
        endChapter: 8,
        endVerse: 5,
      },
    );
    expect(labels(packed)).toEqual(["Romans 7:21-25", "Romans 8:1-5"]);
  });

  it("still labels a chapter the range covers whole", () => {
    const packed = applyLearningSections(
      rangePieces("Psalms", [
        [132, 15, 16],
        [132, 17, 18],
        [133, 1, 3],
        [134, 1, 3],
      ]),
      {
        book: "Psalms",
        startChapter: 132,
        startVerse: 15,
        endChapter: 134,
        endVerse: 3,
      },
    );
    expect(labels(packed)).toEqual(["Psalm 132:15-133:3", "Psalm 134"]);
  });
});

describe("pieceVerseCount", () => {
  it("counts inclusive verse spans", () => {
    expect(pieceVerseCount(piece(0, 1, 4))).toBe(4);
  });
});
