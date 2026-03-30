import { describe, expect, it } from "vitest";
import { sliceEsvChapterToVerseRange } from "./esv-api";

describe("sliceEsvChapterToVerseRange", () => {
  const chapter = {
    canonical: "John 3",
    copyright: "(c)",
    verses: [
      { number: 15, text: "v15" },
      { number: 16, text: "v16" },
      { number: 17, text: "v17" },
      { number: 18, text: "v18" },
      { number: 19, text: "v19" },
    ],
  };

  it("returns verses inclusive of start and end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 16, 18);
    expect(sliced.verses.map((v) => v.number)).toEqual([16, 17, 18]);
    expect(sliced.canonical).toBe(chapter.canonical);
    expect(sliced.copyright).toBe(chapter.copyright);
  });

  it("handles reversed start/end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 18, 16);
    expect(sliced.verses.map((v) => v.number)).toEqual([16, 17, 18]);
  });
});
