import { describe, expect, it } from "vitest";
import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";

describe("getVerseRefBoundsErrorMessage", () => {
  it("names a one-chapter book without a chapter number when a verse is out of range", () => {
    expect(
      getVerseRefBoundsErrorMessage({
        book: "Jude",
        chapter: 1,
        startVerse: 30,
        endVerse: 30,
      }),
    ).toBe("Jude only has 25 verses.");
    expect(
      getVerseRefBoundsErrorMessage({
        book: "Obadiah",
        chapter: 1,
        startVerse: 22,
        endVerse: 22,
      }),
    ).toBe("Obadiah only has 21 verses.");
  });

  it("keeps book plus chapter for a multi-chapter book when a verse is out of range", () => {
    expect(
      getVerseRefBoundsErrorMessage({
        book: "John",
        chapter: 3,
        startVerse: 37,
        endVerse: 37,
      }),
    ).toBe("John 3 only has 36 verses.");
  });

  it("keeps verse-0 and reversed-range messages", () => {
    expect(
      getVerseRefBoundsErrorMessage({
        book: "Jude",
        chapter: 1,
        startVerse: 0,
        endVerse: 0,
      }),
    ).toBe("Verses start at 1.");
    expect(
      getVerseRefBoundsErrorMessage({
        book: "John",
        chapter: 3,
        startVerse: 5,
        endVerse: 3,
      }),
    ).toBe("That range is backwards.");
  });
});
