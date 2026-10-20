import { describe, expect, it } from "vitest";

import type { EsvVerse } from "../../shared/esv-api";
import { planPassagePieces } from "./use-start-passage";

function chapter(
  book: string,
  chapterNumber: number,
  numbers: readonly number[],
  text: (n: number) => string = (n) => `Verse ${n} says something true.`,
): { book: string; chapter: number; verses: EsvVerse[] } {
  return {
    book,
    chapter: chapterNumber,
    verses: numbers.map((number) => ({ number, text: text(number) })),
  };
}

function through(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

describe("planPassagePieces", () => {
  it("plans Philippians 2:1–11 as a passage over exactly its verses", () => {
    const range = {
      book: "Philippians",
      startChapter: 2,
      startVerse: 1,
      endChapter: 2,
      endVerse: 11,
    };
    const plan = planPassagePieces(
      [chapter("Philippians", 2, through(1, 30))],
      range,
    );
    expect(plan.kind).toBe("passage");
    if (plan.kind !== "passage") return;
    expect(plan.range).toEqual(range);
    expect(plan.pieces[0]).toMatchObject({ chapter: 2, startVerse: 1 });
    expect(plan.pieces.at(-1)).toMatchObject({ chapter: 2, endVerse: 11 });
  });

  it("memorizes a 4-verse range that groups into one piece as one card", () => {
    const fourShort = planPassagePieces(
      [chapter("Psalms", 23, through(1, 6), () => "The Lord is my shepherd,")],
      {
        book: "Psalms",
        startChapter: 23,
        startVerse: 1,
        endChapter: 23,
        endVerse: 4,
      },
    );
    expect(fourShort).toEqual({
      kind: "oneCard",
      span: { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 4 },
    });
  });

  it("keeps a range that crosses chapters a passage, however short", () => {
    const plan = planPassagePieces(
      [
        chapter("Romans", 7, through(1, 25), () => "Wretched man that I am,"),
        chapter("Romans", 8, through(1, 39), () => "There is therefore now,"),
      ],
      {
        book: "Romans",
        startChapter: 7,
        startVerse: 24,
        endChapter: 8,
        endVerse: 2,
      },
    );
    expect(plan.kind).toBe("passage");
    if (plan.kind !== "passage") return;
    expect(
      plan.pieces.map((piece) => [
        piece.chapter,
        piece.startVerse,
        piece.endVerse,
      ]),
    ).toEqual([
      [7, 24, 25],
      [8, 1, 2],
    ]);
    expect(plan.pieces[0]?.sectionLabel).toBe("Romans 7:24-8:2");
  });

  it("narrows a range to the verses the text has", () => {
    const plan = planPassagePieces(
      [chapter("Matthew", 17, [...through(1, 20), ...through(22, 27)])],
      {
        book: "Matthew",
        startChapter: 17,
        startVerse: 21,
        endChapter: 17,
        endVerse: 27,
      },
    );
    expect(plan.kind).toBe("passage");
    if (plan.kind !== "passage") return;
    expect(plan.range).toEqual({
      book: "Matthew",
      startChapter: 17,
      startVerse: 22,
      endChapter: 17,
      endVerse: 27,
    });
  });

  it("makes a range that narrows below four verses one card", () => {
    const longVerse = () =>
      "And they were greatly distressed when he told them all of this.";
    const text = chapter(
      "Matthew",
      17,
      [...through(1, 20), ...through(22, 27)],
      longVerse,
    );
    expect(
      planPassagePieces([text], {
        book: "Matthew",
        startChapter: 17,
        startVerse: 22,
        endChapter: 17,
        endVerse: 25,
      }),
    ).toMatchObject({ kind: "passage" });
    expect(
      planPassagePieces([text], {
        book: "Matthew",
        startChapter: 17,
        startVerse: 21,
        endChapter: 17,
        endVerse: 24,
      }),
    ).toEqual({
      kind: "oneCard",
      span: { book: "Matthew", chapter: 17, startVerse: 22, endVerse: 24 },
    });
  });

  it("keeps whole chapters without a range", () => {
    const plan = planPassagePieces([chapter("Psalms", 1, through(1, 6))], null);
    expect(plan).toMatchObject({ kind: "passage", range: null });
  });

  it("fails when the text has none of the range", () => {
    expect(() =>
      planPassagePieces([chapter("Psalms", 1, [])], {
        book: "Psalms",
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 4,
      }),
    ).toThrow("Could not load the verses for this passage");
  });
});
