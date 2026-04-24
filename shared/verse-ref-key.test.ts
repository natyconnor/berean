import { describe, expect, it } from "vitest";
import { verseRefKey } from "./verse-ref-key";

describe("verseRefKey", () => {
  it("formats refs as book|chapter|start|end", () => {
    expect(
      verseRefKey({ book: "John", chapter: 3, startVerse: 16, endVerse: 17 }),
    ).toBe("John|3|16|17");
  });

  it("preserves book names with spaces", () => {
    expect(
      verseRefKey({
        book: "1 Corinthians",
        chapter: 13,
        startVerse: 1,
        endVerse: 13,
      }),
    ).toBe("1 Corinthians|13|1|13");
  });

  it("matches for equal refs and differs for any changed field", () => {
    const base = { book: "John", chapter: 3, startVerse: 16, endVerse: 17 };
    expect(verseRefKey(base)).toBe(verseRefKey({ ...base }));
    expect(verseRefKey(base)).not.toBe(verseRefKey({ ...base, chapter: 4 }));
    expect(verseRefKey(base)).not.toBe(verseRefKey({ ...base, startVerse: 1 }));
    expect(verseRefKey(base)).not.toBe(verseRefKey({ ...base, endVerse: 18 }));
  });
});
