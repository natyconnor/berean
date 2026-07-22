import { describe, expect, it } from "vitest";
import {
  parseEsvResponse,
  parsePassageIntoVerses,
  sliceEsvChapterToVerseRange,
} from "../../shared/esv-api";

describe("sliceEsvChapterToVerseRange", () => {
  const chapter = {
    canonical: "John 3",
    copyright: "(c)",
    verses: [
      { number: 15, text: "v15" },
      { number: 16, text: "v16", heading: "For God So Loved the World" },
      { number: 17, text: "v17" },
      { number: 18, text: "v18" },
      { number: 19, text: "v19" },
    ],
  };

  it("returns verses inclusive of start and end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 16, 18);
    expect(sliced.verses.map((v) => v.number)).toEqual([16, 17, 18]);
    expect(sliced.verses[0]?.heading).toBe("For God So Loved the World");
    expect(sliced.canonical).toBe(chapter.canonical);
    expect(sliced.copyright).toBe(chapter.copyright);
  });

  it("handles reversed start/end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 18, 16);
    expect(sliced.verses.map((v) => v.number)).toEqual([16, 17, 18]);
  });
});

describe("parsePassageIntoVerses", () => {
  it("attaches section headings to the following verse", () => {
    const text = `Matthew 5

The Sermon on the Mount

  [1] Seeing the crowds, he went up on the mountain.

The Beatitudes

  [2] And he opened his mouth and taught them, saying:

  [3] “Blessed are the poor in spirit.

Salt and Light

  [13] “You are the salt of the earth.
`;

    const verses = parsePassageIntoVerses(text, "Matthew 5");
    expect(verses).toEqual([
      {
        number: 1,
        text: "Seeing the crowds, he went up on the mountain.",
        heading: "The Sermon on the Mount",
      },
      {
        number: 2,
        text: "And he opened his mouth and taught them, saying:",
        heading: "The Beatitudes",
      },
      {
        number: 3,
        text: "“Blessed are the poor in spirit.",
      },
      {
        number: 13,
        text: "“You are the salt of the earth.",
        heading: "Salt and Light",
      },
    ]);
  });

  it("does not treat indented poetry lines as headings", () => {
    const text = `Psalm 1

  [1] Blessed is the man
    who walks not in the counsel of the wicked,

  [2] but his delight is in the law of the Lord.
`;
    const verses = parsePassageIntoVerses(text, "Psalm 1");
    expect(verses[0]?.heading).toBeUndefined();
    expect(verses[0]?.text).toContain("who walks not");
    expect(verses[1]?.heading).toBeUndefined();
  });
});

describe("parseEsvResponse", () => {
  it("parses headings from a full ESV-shaped payload", () => {
    const result = parseEsvResponse({
      canonical: "Matthew 5",
      passages: [
        `Matthew 5

The Sermon on the Mount

  [1] Seeing the crowds.

The Beatitudes

  [2] And he opened his mouth.

Scripture quotations are from the ESV® Bible.`,
      ],
    });

    expect(result.canonical).toBe("Matthew 5");
    expect(result.verses[0]).toEqual({
      number: 1,
      text: "Seeing the crowds.",
      heading: "The Sermon on the Mount",
    });
    expect(result.verses[1]).toEqual({
      number: 2,
      text: "And he opened his mouth.",
      heading: "The Beatitudes",
    });
    expect(result.copyright).toContain("Scripture quotations");
  });
});
