import { describe, expect, it } from "vitest";

import type { EsvVerse } from "../../shared/esv-api";
import { groupChapterForHearting } from "./memory-span-group";
import { buildPassagePieces } from "./passage-pieces";

function verse(
  number: number,
  text: string,
  extra?: Pick<EsvVerse, "heading" | "subheading">,
): EsvVerse {
  return { number, text, ...extra };
}

const ELEVEN = "one two three four five six seven eight nine ten eleven.";

function sequentialChapter(
  endVerse: number,
  textFor: (n: number) => EsvVerse,
): EsvVerse[] {
  return Array.from({ length: endVerse }, (_, i) => textFor(i + 1));
}

describe("buildPassagePieces", () => {
  it("groups John 3 with empty hearts the same way as groupChapterForHearting", () => {
    const verses: EsvVerse[] = [
      verse(1, "Now there was a man"),
      verse(2, "of the Pharisees."),
      verse(3, ELEVEN),
      verse(4, "Jesus answered him,"),
      verse(
        5,
        "Truly, truly, I say to you, unless one is born again he cannot see.",
      ),
      verse(6, "After this heading the unit is new.", {
        heading: "He Must Increase",
      }),
    ];

    const grouped = groupChapterForHearting("John", 3, verses, []);
    const pieces = buildPassagePieces([{ book: "John", chapter: 3, verses }]);

    expect(
      pieces.map((p) => ({ start: p.startVerse, end: p.endVerse })),
    ).toEqual(grouped.map((g) => ({ start: g.startVerse, end: g.endVerse })));
    expect(pieces.map((p) => p.index)).toEqual([0, 1, 2, 3]);
    expect(grouped.every((g) => g.kind === "proposed")).toBe(true);
  });

  it("starts a new section on an ESV heading and labels it", () => {
    const verses: EsvVerse[] = [
      verse(1, "Now there was a man"),
      verse(2, "of the Pharisees."),
      verse(3, ELEVEN),
      verse(4, "Jesus answered him,"),
      verse(
        5,
        "Truly, truly, I say to you, unless one is born again he cannot see.",
      ),
      verse(6, "After this heading the unit is new.", {
        heading: "He Must Increase",
      }),
    ];

    const pieces = buildPassagePieces([{ book: "John", chapter: 3, verses }]);
    expect(pieces[0]?.sectionIndex).toBe(0);
    expect(pieces[0]?.sectionLabel).toBe("Chapter 3");
    expect(pieces.slice(1, 3).every((p) => p.sectionIndex === 0)).toBe(true);
    expect(pieces.slice(1, 3).every((p) => p.sectionLabel === undefined)).toBe(
      true,
    );

    const headingPiece = pieces.find((p) => p.startVerse === 6);
    expect(headingPiece?.sectionIndex).toBe(1);
    expect(headingPiece?.sectionLabel).toBe("He Must Increase");
  });

  it("starts a new section when the chapter changes", () => {
    const chapter3: EsvVerse[] = [
      verse(1, "Now there was a man of the Pharisees."),
    ];
    const chapter4: EsvVerse[] = [
      verse(1, "Now when Jesus learned that the Pharisees had heard."),
    ];

    const pieces = buildPassagePieces([
      { book: "John", chapter: 3, verses: chapter3 },
      { book: "John", chapter: 4, verses: chapter4 },
    ]);

    expect(pieces).toHaveLength(2);
    expect(pieces[0]?.sectionIndex).toBe(0);
    expect(pieces[0]?.sectionLabel).toBe("Chapter 3");
    expect(pieces[1]?.sectionIndex).toBe(1);
    expect(pieces[1]?.sectionLabel).toBe("Chapter 4");
    expect(pieces[1]?.chapter).toBe(4);
  });

  it("does not fragment empty-heart grouping around a famous verse", () => {
    const verses = sequentialChapter(21, (n) => verse(n, ELEVEN));
    const pieces = buildPassagePieces([{ book: "John", chapter: 3, verses }]);
    const grouped = groupChapterForHearting("John", 3, verses, []);

    expect(pieces.map((p) => [p.startVerse, p.endVerse])).toEqual(
      grouped.map((g) => [g.startVerse, g.endVerse]),
    );
    const aroundSixteen = pieces.filter(
      (p) => p.startVerse <= 16 && p.endVerse >= 16,
    );
    expect(aroundSixteen).toHaveLength(1);
    expect(aroundSixteen[0]?.startVerse).toBe(16);
    expect(aroundSixteen[0]?.endVerse).toBe(16);
  });

  it("starts a new section on a subheading", () => {
    const verses: EsvVerse[] = [
      verse(1, "She speaks without ending"),
      verse(2, "He answers after the speaker label.", { subheading: "He" }),
    ];
    const pieces = buildPassagePieces([
      { book: "Song of Solomon", chapter: 1, verses },
    ]);
    expect(pieces[0]?.sectionLabel).toBe("Chapter 1");
    expect(pieces[1]?.sectionIndex).toBe(1);
    expect(pieces[1]?.sectionLabel).toBe("He");
  });
});
