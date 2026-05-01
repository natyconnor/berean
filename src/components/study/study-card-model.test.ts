import { describe, expect, it } from "vitest";

import { countDistinctTeachPassageRefs } from "./study-card-model";

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
