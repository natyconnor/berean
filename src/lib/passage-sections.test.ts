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

describe("pieceVerseCount", () => {
  it("counts inclusive verse spans", () => {
    expect(pieceVerseCount(piece(0, 1, 4))).toBe(4);
  });
});
