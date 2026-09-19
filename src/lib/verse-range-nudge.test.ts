import { describe, expect, it } from "vitest";
import { nudgeVerseRange, verseRangeBounds } from "./verse-range-nudge";
import type { VerseRef } from "./verse-ref-utils";

const john1 = (startVerse: number, endVerse = startVerse): VerseRef => ({
  book: "John",
  chapter: 1,
  startVerse,
  endVerse,
});

describe("verseRangeBounds", () => {
  it("disables shrink on a single verse and grow at chapter bounds", () => {
    expect(verseRangeBounds(john1(1), 51)).toEqual({
      canGrowStart: false,
      canShrinkStart: false,
      canGrowEnd: true,
      canShrinkEnd: false,
    });
    expect(verseRangeBounds(john1(51), 51)).toEqual({
      canGrowStart: true,
      canShrinkStart: false,
      canGrowEnd: false,
      canShrinkEnd: false,
    });
  });

  it("allows independent start and end nudges on a range", () => {
    expect(verseRangeBounds(john1(15, 17), 51)).toEqual({
      canGrowStart: true,
      canShrinkStart: true,
      canGrowEnd: true,
      canShrinkEnd: true,
    });
  });

  it("treats an unknown chapter length as unable to grow the end", () => {
    expect(verseRangeBounds(john1(16), null).canGrowEnd).toBe(false);
  });
});

describe("nudgeVerseRange", () => {
  it("adds or removes one verse at each end", () => {
    expect(nudgeVerseRange(john1(16), "end", "grow", 51)).toEqual(
      john1(16, 17),
    );
    expect(nudgeVerseRange(john1(16, 17), "start", "grow", 51)).toEqual(
      john1(15, 17),
    );
    expect(nudgeVerseRange(john1(15, 17), "start", "shrink", 51)).toEqual(
      john1(16, 17),
    );
    expect(nudgeVerseRange(john1(16, 17), "end", "shrink", 51)).toEqual(
      john1(16),
    );
  });

  it("returns null at bounds instead of leaving the chapter or dropping the last verse", () => {
    expect(nudgeVerseRange(john1(1), "start", "grow", 51)).toBeNull();
    expect(nudgeVerseRange(john1(51), "end", "grow", 51)).toBeNull();
    expect(nudgeVerseRange(john1(16), "start", "shrink", 51)).toBeNull();
    expect(nudgeVerseRange(john1(16), "end", "shrink", 51)).toBeNull();
  });
});
