import { describe, expect, it } from "vitest";

import {
  firstChapterHeart,
  heartListLabel,
  heartMatchesBookFilter,
  passageHeartAnchor,
} from "./heart-list";

describe("passageHeartAnchor", () => {
  it("picks the newest row, breaking createdAt ties by creation time", () => {
    const rows = [
      { id: "a", createdAt: 10, _creationTime: 1 },
      { id: "b", createdAt: 10, _creationTime: 3 },
      { id: "c", createdAt: 10, _creationTime: 2 },
      { id: "d", createdAt: 5, _creationTime: 9 },
    ];
    expect(passageHeartAnchor(rows)?.id).toBe("b");
    expect(passageHeartAnchor([])).toBeUndefined();
  });
});

describe("firstChapterHeart", () => {
  it("picks the lowest chapter, then the lowest start verse", () => {
    const span = (chapter: number, startVerse: number) => ({
      span: { book: "Matthew", chapter, startVerse, endVerse: startVerse + 5 },
    });
    const rows = [span(7, 1), span(5, 3), span(6, 1), span(5, 1)];
    expect(firstChapterHeart(rows)).toBe(rows[3]);
  });
});

describe("heartListLabel", () => {
  it("names a verse by its reference and a passage by its title", () => {
    const span = { book: "Psalms", chapter: 16, startVerse: 1, endVerse: 11 };
    expect(heartListLabel(span)).toBe("Psalm 16:1–11");
    expect(heartListLabel({ ...span, passage: { title: "Psalm 16" } })).toBe(
      "Psalm 16 · passage",
    );
  });
});

describe("heartMatchesBookFilter", () => {
  it("matches the book name, its reference form, or its abbreviation", () => {
    expect(heartMatchesBookFilter("Psalms", "")).toBe(true);
    expect(heartMatchesBookFilter("Psalms", "  PSAL ")).toBe(true);
    expect(heartMatchesBookFilter("1 Corinthians", "cor")).toBe(true);
    expect(heartMatchesBookFilter("1 Corinthians", "1co", "1Cor")).toBe(true);
    expect(heartMatchesBookFilter("Romans", "john")).toBe(false);
  });
});
