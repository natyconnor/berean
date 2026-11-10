import { describe, expect, it } from "vitest";

import type { CompositePassageSegment } from "@/hooks/use-esv-composite-passage";
import { maskVerseText } from "@/lib/verse-hint";

import { firstLettersHintText } from "./use-passage-review";

const PS131_1 =
  "O Lord, my heart is not lifted up; my eyes are not raised too high; I do not occupy myself with things too great and too marvelous for me.";
const PS131_2 =
  "But I have calmed and quieted my soul, like a weaned child with its mother; like a weaned child is my soul within me.";
const PS131_3 =
  "O Israel, hope in the Lord from this time forth and forevermore.";

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

describe("firstLettersHintText (#378)", () => {
  it("puts each verse of Psalm 131 on its own line, even inside one piece", () => {
    const hint = firstLettersHintText(
      [
        segment(131, [
          [1, PS131_1],
          [2, PS131_2],
        ]),
        segment(131, [[3, PS131_3]]),
      ],
      [],
    );
    expect(hint).toBe(
      [letters(PS131_1), letters(PS131_2), letters(PS131_3)].join("\n"),
    );
    expect(hint).not.toMatch(/\d/);
  });

  it("keeps a blank, unhinted verse on its own line", () => {
    const hint = firstLettersHintText(
      [
        segment(131, [
          [1, PS131_1],
          [2, PS131_2],
          [3, PS131_3],
        ]),
      ],
      [{ chapter: 131, verse: 2 }],
    );
    expect(hint.split("\n")).toEqual([
      blank(PS131_1),
      letters(PS131_2),
      blank(PS131_3),
    ]);
  });

  it("leaves a blank line, and no heading, where the chapter changes", () => {
    const hint = firstLettersHintText(
      [
        segment(130, [[8, PS131_3]]),
        segment(131, [
          [1, PS131_1],
          [2, PS131_2],
        ]),
      ],
      [],
    );
    expect(hint).toBe(
      `${letters(PS131_3)}\n\n${letters(PS131_1)}\n${letters(PS131_2)}`,
    );
  });

  it("gives a one-verse passage no extra line", () => {
    expect(firstLettersHintText([segment(131, [[3, PS131_3]])], [])).toBe(
      letters(PS131_3),
    );
  });
});
