import { describe, expect, it } from "vitest";

import type { EsvVerse } from "../../shared/esv-api";
import { passageHeartSpans } from "./hearted-verse-coverage";
import { groupChapterForHearting } from "./memory-span-group";
import { buildPassagePieces, type PassagePieceBase } from "./passage-pieces";
import { assertPiecesMatchScope } from "./passage-start";

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

  it("packs learning sections by verse count, not ESV headings", () => {
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
    expect(pieces[0]?.sectionLabel).toBe("John 3");
    expect(pieces.every((p) => p.sectionIndex === 0)).toBe(true);
    expect(pieces.some((p) => p.sectionLabel === "He Must Increase")).toBe(
      false,
    );
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
    expect(pieces[0]?.sectionLabel).toBe("John 3");
    expect(pieces[1]?.sectionIndex).toBe(1);
    expect(pieces[1]?.sectionLabel).toBe("John 4");
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

  describe("with a passage range", () => {
    const chapterText = (book: string, chapter: number, count: number) => ({
      book,
      chapter,
      verses: sequentialChapter(count, (n) =>
        verse(n, n % 3 === 0 ? ELEVEN : `Verse ${n} runs on`),
      ),
    });
    const coveredVerses = (pieces: PassagePieceBase[]) =>
      pieces.flatMap((piece) =>
        Array.from(
          { length: piece.endVerse - piece.startVerse + 1 },
          (_, i) => `${piece.chapter}:${piece.startVerse + i}`,
        ),
      );

    it.each([
      [
        "Philippians 2:1–11",
        [chapterText("Philippians", 2, 30)],
        {
          book: "Philippians",
          startChapter: 2,
          startVerse: 1,
          endChapter: 2,
          endVerse: 11,
        },
        Array.from({ length: 11 }, (_, i) => `2:${i + 1}`),
      ],
      [
        "Romans 7:24–8:2",
        [chapterText("Romans", 7, 25), chapterText("Romans", 8, 39)],
        {
          book: "Romans",
          startChapter: 7,
          startVerse: 24,
          endChapter: 8,
          endVerse: 2,
        },
        ["7:24", "7:25", "8:1", "8:2"],
      ],
      [
        "Romans 8:28–39",
        [chapterText("Romans", 8, 39)],
        {
          book: "Romans",
          startChapter: 8,
          startVerse: 28,
          endChapter: 8,
          endVerse: 39,
        },
        Array.from({ length: 12 }, (_, i) => `8:${i + 28}`),
      ],
    ])("covers exactly %s, in order", (_label, chapters, range, expected) => {
      const pieces = buildPassagePieces(chapters, range);
      expect(coveredVerses(pieces)).toEqual(expected);
      expect(pieces.map((piece) => piece.index)).toEqual(
        pieces.map((_, index) => index),
      );
      expect(() =>
        assertPiecesMatchScope(
          pieces,
          {
            books: [range.book],
            chapterRanges: [
              {
                book: range.book,
                startChapter: range.startChapter,
                endChapter: range.endChapter,
              },
            ],
          },
          range,
        ),
      ).not.toThrow();
    });

    it("hearts only the range's verses in each chapter", () => {
      const pieces = buildPassagePieces(
        [chapterText("Romans", 7, 25), chapterText("Romans", 8, 39)],
        {
          book: "Romans",
          startChapter: 7,
          startVerse: 24,
          endChapter: 8,
          endVerse: 2,
        },
      );
      expect(passageHeartSpans(pieces)).toEqual([
        { book: "Romans", chapter: 7, startVerse: 24, endVerse: 25 },
        { book: "Romans", chapter: 8, startVerse: 1, endVerse: 2 },
      ]);
    });

    it("skips a verse the text leaves out", () => {
      const chapter = chapterText("Matthew", 17, 27);
      const pieces = buildPassagePieces(
        [{ ...chapter, verses: chapter.verses.filter((v) => v.number !== 21) }],
        {
          book: "Matthew",
          startChapter: 17,
          startVerse: 19,
          endChapter: 17,
          endVerse: 23,
        },
      );
      expect(coveredVerses(pieces)).toEqual([
        "17:19",
        "17:20",
        "17:22",
        "17:23",
      ]);
    });
  });

  it("keeps whole-chapter pieces and sections unchanged", () => {
    const summarize = (pieces: PassagePieceBase[]) =>
      pieces.map(
        (piece) =>
          `${piece.chapter}:${piece.startVerse}-${piece.endVerse} s${piece.sectionIndex}${piece.sectionLabel ? ` ${piece.sectionLabel}` : ""}`,
      );
    const mixed = (n: number) =>
      verse(
        n,
        n % 4 === 0
          ? ELEVEN
          : n % 5 === 0
            ? "Short line."
            : `And verse ${n} keeps going,`,
        n === 9 ? { heading: "A Heading" } : undefined,
      );

    expect(
      summarize(
        buildPassagePieces([
          { book: "Psalms", chapter: 1, verses: sequentialChapter(6, mixed) },
        ]),
      ),
    ).toMatchInlineSnapshot(`
      [
        "1:1-4 s0 Psalm 1",
        "1:5-6 s0",
      ]
    `);
    expect(
      summarize(
        buildPassagePieces([
          { book: "John", chapter: 3, verses: sequentialChapter(36, mixed) },
        ]),
      ),
    ).toMatchInlineSnapshot(`
      [
        "3:1-4 s0 John 3:1-8",
        "3:5-8 s0",
        "3:9-12 s1 John 3:9-15",
        "3:13-15 s1",
        "3:16-16 s2 John 3:16-20",
        "3:17-20 s2",
        "3:21-24 s3 John 3:21-28",
        "3:25-28 s3",
        "3:29-32 s4 John 3:29-36",
        "3:33-35 s4",
        "3:36-36 s4",
      ]
    `);
    expect(
      summarize(
        buildPassagePieces([
          { book: "Matthew", chapter: 6, verses: sequentialChapter(34, mixed) },
          { book: "Matthew", chapter: 7, verses: sequentialChapter(29, mixed) },
          { book: "Psalms", chapter: 117, verses: sequentialChapter(2, mixed) },
        ]),
      ),
    ).toMatchInlineSnapshot(`
      [
        "6:1-4 s0 Matthew 6:1-8",
        "6:5-8 s0",
        "6:9-12 s1 Matthew 6:9-15",
        "6:13-15 s1",
        "6:16-16 s2 Matthew 6:16-20",
        "6:17-20 s2",
        "6:21-24 s3 Matthew 6:21-28",
        "6:25-28 s3",
        "6:29-32 s4 Matthew 6:29-34",
        "6:33-34 s4",
        "7:1-4 s5 Matthew 7:1-8",
        "7:5-8 s5",
        "7:9-12 s6 Matthew 7:9-16",
        "7:13-15 s6",
        "7:16-16 s6",
        "7:17-20 s7 Matthew 7:17-24",
        "7:21-24 s7",
        "7:25-28 s8 Matthew 7:25-29",
        "7:29-29 s8",
        "117:1-2 s9 Psalm 117",
      ]
    `);
  });

  it("does not start a learning section on a subheading", () => {
    const verses: EsvVerse[] = [
      verse(1, "She speaks without ending"),
      verse(2, "He answers after the speaker label.", { subheading: "He" }),
    ];
    const pieces = buildPassagePieces([
      { book: "Song of Solomon", chapter: 1, verses },
    ]);
    expect(pieces[0]?.sectionLabel).toBe("Song of Solomon 1");
    expect(pieces.every((p) => p.sectionIndex === 0)).toBe(true);
    expect(pieces.some((p) => p.sectionLabel === "He")).toBe(false);
  });
});
