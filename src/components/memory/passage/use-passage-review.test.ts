import { describe, expect, it } from "vitest";

import type { CompositePassageSegment } from "@/hooks/use-esv-composite-passage";
import { maskVerseText, type VerseHint } from "@/lib/verse-hint";

import { firstLettersHintVerses } from "./use-passage-review";

const PS131_1 =
  "O Lord, my heart is not lifted up;\n    my eyes are not raised too high;";
const PS131_2 =
  "But I have calmed and quieted my soul,\n    like a weaned child with its mother;";
const PS131_3 =
  "O Israel, hope in the Lord\n    from this time forth and forevermore.";

function segment(
  chapter: number,
  verses: Array<[number, string]>,
): CompositePassageSegment {
  return {
    reference: {
      book: "Psalms",
      chapter,
      startVerse: verses[0]?.[0] ?? 1,
      endVerse: verses[verses.length - 1]?.[0] ?? 1,
    },
    text: verses.map(([, text]) => text).join(" "),
    verses: verses.map(([number, text]) => ({ number, text })),
  };
}

const letters = (text: string) =>
  maskVerseText(text, "first-letters")
    .map((token) => token.text)
    .join("");
const blank = (text: string) =>
  maskVerseText(text, "hidden")
    .map((token) => token.text)
    .join("");

/** Each block's chapter and text. */
const blocks = (verses: readonly VerseHint[]) =>
  verses.map((verse) => [
    verse.chapter,
    verse.tokens.map((token) => token.text).join(""),
  ]);

describe("firstLettersHintVerses (#378)", () => {
  it("gives each verse of Psalm 131 its own block, even inside one piece", () => {
    const hint = firstLettersHintVerses(
      [
        segment(131, [
          [1, PS131_1],
          [2, PS131_2],
        ]),
        segment(131, [[3, PS131_3]]),
      ],
      [],
    );
    expect(blocks(hint)).toEqual([
      ["Psalms|131", letters(PS131_1)],
      ["Psalms|131", letters(PS131_2)],
      ["Psalms|131", letters(PS131_3)],
    ]);
    // Poetry lines stay single line breaks; no blank lines, no verse numbers.
    for (const [, text] of blocks(hint)) {
      expect(text).not.toMatch(/\n\s*\n|\d/);
    }
  });

  it("keeps a blank, unhinted verse in its own block", () => {
    const hint = firstLettersHintVerses(
      [
        segment(131, [
          [1, PS131_1],
          [2, PS131_2],
          [3, PS131_3],
        ]),
      ],
      [{ chapter: 131, verse: 2 }],
    );
    expect(blocks(hint).map(([, text]) => text)).toEqual([
      blank(PS131_1),
      letters(PS131_2),
      blank(PS131_3),
    ]);
  });

  it("marks a chapter change by the block's chapter, with no heading text", () => {
    const hint = firstLettersHintVerses(
      [
        segment(130, [[8, PS131_3]]),
        segment(131, [
          [1, PS131_1],
          [2, PS131_2],
        ]),
      ],
      [],
    );
    expect(blocks(hint)).toEqual([
      ["Psalms|130", letters(PS131_3)],
      ["Psalms|131", letters(PS131_1)],
      ["Psalms|131", letters(PS131_2)],
    ]);
  });

  it("gives a one-verse passage one block", () => {
    expect(
      blocks(firstLettersHintVerses([segment(131, [[3, PS131_3]])], [])),
    ).toEqual([["Psalms|131", letters(PS131_3)]]);
  });
});
