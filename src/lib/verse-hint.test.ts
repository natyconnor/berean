import { describe, expect, it } from "vitest";

import { SUPPORT_BANDS } from "./memory-scheduler";
import { hintForProgress, maskVerseText } from "./verse-hint";

const CLOZE_TEXT =
  "In the beginning God created the heavens and the earth with wisdom";

/** Indices of word tokens that keep a first-letter hint (i.e. not a full blank). */
function firstLetterHintIndices(
  tokens: ReturnType<typeof maskVerseText>,
): number[] {
  const indices: number[] = [];
  let wordIndex = -1;
  for (const token of tokens) {
    if (!token.word) continue;
    wordIndex += 1;
    if (!/^_+$/.test(token.text)) indices.push(wordIndex);
  }
  return indices;
}

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

  describe("density and seed options", () => {
    it("reshuffles the hinted subset per seed while staying deterministic", () => {
      const density = 0.5;
      const seedA1 = maskVerseText(CLOZE_TEXT, "cloze", { density, seed: 1 });
      const seedA2 = maskVerseText(CLOZE_TEXT, "cloze", { density, seed: 1 });
      const seedB = maskVerseText(CLOZE_TEXT, "cloze", { density, seed: 2 });

      // Deterministic for a fixed seed.
      expect(seedA1).toEqual(seedA2);

      const subsetA = firstLetterHintIndices(seedA1);
      const subsetB = firstLetterHintIndices(seedB);

      // Same density -> same number of hints, but a different subset.
      expect(subsetB.length).toBe(subsetA.length);
      expect(subsetB).not.toEqual(subsetA);
    });

    it("shows fewer first-letter hints at a lower density", () => {
      const sparse = maskVerseText(CLOZE_TEXT, "cloze", {
        density: 0.25,
        seed: 7,
      });
      const dense = maskVerseText(CLOZE_TEXT, "cloze", {
        density: 0.75,
        seed: 7,
      });

      expect(firstLetterHintIndices(sparse).length).toBeLessThan(
        firstLetterHintIndices(dense).length,
      );
    });

    it("still masks every word and preserves punctuation/spacing with options", () => {
      const tokens = maskVerseText(CLOZE_TEXT, "cloze", {
        density: 0.5,
        seed: 3,
      });
      const originalWords = CLOZE_TEXT.split(/\s+/);
      const wordTokens = tokens.filter((token) => token.word);

      expect(wordTokens).toHaveLength(originalWords.length);
      expect(wordTokens.every((token) => token.masked)).toBe(true);
      for (let index = 0; index < wordTokens.length; index += 1) {
        // No word ever renders as its plain original form.
        expect(wordTokens[index].text).not.toBe(originalWords[index]);
      }

      // Punctuation and spacing tokens survive untouched.
      const nonWords = tokens.filter((token) => !token.word);
      expect(nonWords.every((token) => !token.masked)).toBe(true);
      expect(tokens.map((token) => token.text).join("")).not.toBe(CLOZE_TEXT);
      expect(
        tokens
          .filter((token) => !token.word)
          .map((token) => token.text)
          .join(""),
      ).toBe(" ".repeat(originalWords.length - 1));
    });

    it("keeps default cloze behavior unchanged when no options are passed", () => {
      expect(maskVerseText(CLOZE_TEXT, "cloze")).toEqual(
        maskVerseText(CLOZE_TEXT, "cloze", {}),
      );
    });
  });
});

describe("hintForProgress", () => {
  it("maps the read band (stage 0) to full text", () => {
    expect(hintForProgress(0, 0)).toEqual({
      stage: "full",
      density: 0,
      seed: 0,
    });
  });

  it("maps the guided band (stage 1) to full-density first letters", () => {
    expect(hintForProgress(1, 0)).toEqual({
      stage: "first-letters",
      density: 1,
      seed: 0,
    });
    expect(hintForProgress(1, 3)).toEqual({
      stage: "first-letters",
      density: 1,
      seed: 0,
    });
  });

  it("fades the challenge band (stage 2) from densityStart to densityEnd", () => {
    const challenge = SUPPORT_BANDS[2];
    const lastRep = challenge.requiredReps - 1;

    // First rep holds at densityStart, seeded by stageReps.
    expect(hintForProgress(2, 0)).toEqual({
      stage: "cloze",
      density: challenge.densityStart,
      seed: 0,
    });

    // Final rep reaches densityEnd.
    const atEnd = hintForProgress(2, lastRep);
    expect(atEnd.stage).toBe("cloze");
    expect(atEnd.seed).toBe(lastRep);
    expect(atEnd.density).toBeCloseTo(challenge.densityEnd ?? 0);

    // Midpoint interpolates between the two, monotonically decreasing.
    const mid = hintForProgress(2, Math.floor(lastRep / 2));
    expect(mid.density).toBeLessThan(hintForProgress(2, 0).density);
    expect(mid.density).toBeGreaterThan(atEnd.density);
  });

  it("maps the memory band (stage 3) to hidden", () => {
    expect(hintForProgress(3, 0)).toEqual({
      stage: "hidden",
      density: 0,
      seed: 0,
    });
  });
});
