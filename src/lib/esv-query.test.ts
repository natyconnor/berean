import { describe, expect, it } from "vitest";

import { isSingleChapterBook, toEsvQuery } from "../../shared/esv-query";

describe("isSingleChapterBook", () => {
  it("flags every one-chapter book", () => {
    for (const book of ["Obadiah", "Philemon", "2 John", "3 John", "Jude"]) {
      expect(isSingleChapterBook(book)).toBe(true);
    }
  });

  it("does not flag multi-chapter books or unknown names", () => {
    for (const book of ["John", "1 John", "Psalms", "Nahum", "Nope"]) {
      expect(isSingleChapterBook(book)).toBe(false);
    }
  });
});

describe("toEsvQuery", () => {
  it("omits the chapter for single-chapter books", () => {
    // `Jude 1` would resolve to Jude verse 1 in the ESV API.
    expect(toEsvQuery("Jude", 1)).toBe("Jude");
    expect(toEsvQuery("Obadiah", 1)).toBe("Obadiah");
    expect(toEsvQuery("3 John", 1)).toBe("3 John");
  });

  it("keeps the chapter for multi-chapter books", () => {
    expect(toEsvQuery("John", 3)).toBe("John 3");
    expect(toEsvQuery("1 John", 1)).toBe("1 John 1");
    expect(toEsvQuery("Psalms", 119)).toBe("Psalms 119");
  });
});
