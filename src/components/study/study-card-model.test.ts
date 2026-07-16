import { describe, expect, it } from "vitest";

import {
  buildStudyCards,
  countDistinctTeachPassageRefs,
} from "./study-card-model";

describe("countDistinctTeachPassageRefs", () => {
  it("dedupes the same ref across multiple notes and within one note", () => {
    const n = countDistinctTeachPassageRefs([
      {
        refs: [
          {
            book: "John",
            chapter: 3,
            startVerse: 16,
            endVerse: 16,
          },
          {
            book: "John",
            chapter: 3,
            startVerse: 16,
            endVerse: 16,
          },
        ],
      },
      {
        refs: [
          {
            book: "John",
            chapter: 3,
            startVerse: 16,
            endVerse: 16,
          },
          {
            book: "John",
            chapter: 3,
            startVerse: 17,
            endVerse: 17,
          },
        ],
      },
    ]);
    expect(n).toBe(2);
  });

  it("returns 0 for empty notes or notes with no refs", () => {
    expect(countDistinctTeachPassageRefs([])).toBe(0);
    expect(countDistinctTeachPassageRefs([{ refs: [] }])).toBe(0);
  });
});

describe("buildStudyCards", () => {
  it("builds one teach card per distinct linked passage", () => {
    const cards = buildStudyCards([
      {
        noteId: "n1",
        content: "note one",
        tags: [],
        refs: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }],
      },
      {
        noteId: "n2",
        content: "note two",
        tags: [],
        refs: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }],
      },
      {
        noteId: "n3",
        content: "note three",
        tags: [],
        refs: [{ book: "Genesis", chapter: 1, startVerse: 1, endVerse: 1 }],
      },
    ]);
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.type === "teach")).toBe(true);
  });
});
