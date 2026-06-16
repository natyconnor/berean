import { describe, expect, it } from "vitest";

import { maskVerseText } from "./verse-hint";

describe("maskVerseText", () => {
  it("returns full text tokens without masking words", () => {
    expect(maskVerseText("Jesus wept.", "full")).toEqual([
      { text: "Jesus", word: true, masked: false },
      { text: " ", word: false, masked: false },
      { text: "wept", word: true, masked: false },
      { text: ".", word: false, masked: false },
    ]);
  });

  it("keeps first letters and preserves punctuation and spacing", () => {
    expect(maskVerseText("For God so loved...", "first-letters")).toEqual([
      { text: "F__", word: true, masked: true },
      { text: " ", word: false, masked: false },
      { text: "G__", word: true, masked: true },
      { text: " ", word: false, masked: false },
      { text: "s_", word: true, masked: true },
      { text: " ", word: false, masked: false },
      { text: "l____", word: true, masked: true },
      { text: "...", word: false, masked: false },
    ]);
  });

  it("deterministically mixes full blanks with first-letter hints for cloze hints", () => {
    const text =
      "In the beginning God created the heavens and the earth with wisdom";
    const first = maskVerseText(text, "cloze");
    const second = maskVerseText(text, "cloze");

    expect(first).toEqual(second);

    const originalWords = text.split(/\s+/);
    const wordTokens = first.filter((token) => token.word);
    expect(wordTokens).toHaveLength(originalWords.length);
    expect(wordTokens.every((token) => token.masked)).toBe(true);
    const fullBlanks = wordTokens.filter((token) => /^_+$/.test(token.text));
    const firstLetterHints = wordTokens.filter((token) =>
      /^[\p{L}\p{N}]['\u2019]?_+$/u.test(token.text),
    );
    expect(fullBlanks.length).toBeGreaterThan(0);
    expect(firstLetterHints.length).toBeGreaterThanOrEqual(
      Math.ceil(originalWords.length * 0.25),
    );
    expect(firstLetterHints.length).toBeLessThanOrEqual(
      Math.floor(originalWords.length * 0.5),
    );

    for (let index = 0; index < wordTokens.length; index += 1) {
      expect(wordTokens[index].text).not.toBe(originalWords[index]);
    }
  });

  it("hides all words at the hidden stage while preserving punctuation", () => {
    expect(maskVerseText("God's word endures.", "hidden")).toEqual([
      { text: "_____", word: true, masked: true },
      { text: " ", word: false, masked: false },
      { text: "____", word: true, masked: true },
      { text: " ", word: false, masked: false },
      { text: "_______", word: true, masked: true },
      { text: ".", word: false, masked: false },
    ]);
  });
});
