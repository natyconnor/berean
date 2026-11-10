import { describe, expect, it } from "vitest";

import {
  missedVerses,
  shakyAfterUnhintedTry,
  shakyFirstLettersHint,
} from "./passage-shaky";

// Psalm 13:3–4 sit in one learning piece; verse 5 is its own.
const V3 = { chapter: 13, verse: 3 };
const V4 = { chapter: 13, verse: 4 };
const V5 = { chapter: 13, verse: 5 };

describe("shakyAfterUnhintedTry", () => {
  it("marks each verse under 85% on its own in a counted try", () => {
    expect(
      shakyAfterUnhintedTry(
        [],
        [
          { ...V3, accuracy: 59 },
          { ...V4, accuracy: 100 },
          { ...V5, accuracy: 84 },
        ],
        true,
      ),
    ).toEqual([V3, V5]);
  });

  it("clears only the verse recited cleanly, even in a practice-only try", () => {
    expect(
      shakyAfterUnhintedTry(
        [V3, V4],
        [
          { ...V3, accuracy: 85 },
          { ...V4, accuracy: 84 },
        ],
        false,
      ),
    ).toEqual([V4]);
  });

  it("never marks in a practice-only try", () => {
    expect(shakyAfterUnhintedTry([], [{ ...V3, accuracy: 10 }], false)).toEqual(
      [],
    );
  });

  it("keeps verses the try did not score, and lists each verse once", () => {
    expect(
      shakyAfterUnhintedTry([V3, V5], [{ ...V5, accuracy: 40 }], true),
    ).toEqual([V3, V5]);
  });
});

describe("missedVerses", () => {
  it("lists verses under 85%", () => {
    expect(
      missedVerses([
        { ...V3, accuracy: 100 },
        { ...V4, accuracy: 85 },
        { ...V5, accuracy: 84 },
      ]),
    ).toEqual([V5]);
  });
});

describe("shakyFirstLettersHint", () => {
  const verses = [
    { ...V3, text: "Consider and answer me," },
    { ...V4, text: "lest my enemy say," },
    { ...V5, text: "But I have trusted" },
  ];

  it("hints a target verse only, never its neighbour in the same piece", () => {
    expect(shakyFirstLettersHint(verses, [V4])).toEqual([
      "________ ___ ______ __,",
      "l___ m_ e____ s__,",
      "___ _ ____ _______",
    ]);
  });

  it("hints every verse when none of them is targeted, never all blanks", () => {
    const every = shakyFirstLettersHint(verses, [V3, V4, V5]);
    expect(shakyFirstLettersHint(verses, [])).toEqual(every);
    expect(shakyFirstLettersHint(verses, [{ chapter: 14, verse: 1 }])).toEqual(
      every,
    );
  });

  it("hints every verse when every verse is targeted", () => {
    expect(shakyFirstLettersHint(verses, [V3, V4, V5])).toEqual([
      "C_______ a__ a_____ m_,",
      "l___ m_ e____ s__,",
      "B__ I h___ t______",
    ]);
  });

  it("with a random, gives each target its own half and blanks the rest", () => {
    // random() = 0 picks the first half of each target verse's own words.
    expect(shakyFirstLettersHint(verses, [V3, V5], () => 0)).toEqual([
      "C_______ a__ ______ __,",
      "____ __ _____ ___,",
      "B__ I ____ _______",
    ]);
  });
});

describe("practice-only recital (S13, AC29)", () => {
  it("clears a shaky verse at 85% but not at 84%, and adds no marks", () => {
    expect(
      shakyAfterUnhintedTry(
        [V3, V4],
        [
          { ...V3, accuracy: 85 },
          { ...V4, accuracy: 84 },
          { ...V5, accuracy: 0 },
        ],
        false,
      ),
    ).toEqual([V4]);
  });
});
