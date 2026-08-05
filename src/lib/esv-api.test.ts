import { describe, expect, it } from "vitest";
import { sliceEsvChapterToVerseRange } from "../../shared/esv-api";

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
    expect(sliced.verses.map((verse) => verse.number)).toEqual([16, 17, 18]);
    expect(sliced.verses[0]?.heading).toBe("For God So Loved the World");
    expect(sliced.canonical).toBe(chapter.canonical);
    expect(sliced.copyright).toBe(chapter.copyright);
  });

  it("handles reversed start/end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 18, 16);
    expect(sliced.verses.map((verse) => verse.number)).toEqual([16, 17, 18]);
  });
});
