import { describe, expect, it } from "vitest";
import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import type { VerseRef } from "@/lib/verse-ref-utils";
import {
  canNudgeVerseRange,
  nudgeVerseRange,
  verseRangeBounds,
} from "./verse-range-nudge";

function ref(
  startVerse: number,
  endVerse: number,
  book = "John",
  chapter = 1,
): VerseRef {
  return { book, chapter, startVerse, endVerse };
}

describe("verse range nudge", () => {
  it("grows and shrinks John 1:16 by one verse at each end", () => {
    const single = ref(16, 16);

    const grownEnd = nudgeVerseRange(single, "end", "grow");
    expect(grownEnd).toEqual(ref(16, 17));

    const grownStart = nudgeVerseRange(single, "start", "grow");
    expect(grownStart).toEqual(ref(15, 16));

    expect(nudgeVerseRange(grownEnd!, "end", "shrink")).toEqual(single);
    expect(nudgeVerseRange(grownStart!, "start", "shrink")).toEqual(single);
  });

  it("refuses to grow before verse 1 or shrink a single verse", () => {
    const first = ref(1, 1);
    expect(canNudgeVerseRange(first, "start", "grow")).toBe(false);
    expect(nudgeVerseRange(first, "start", "grow")).toBeNull();
    expect(canNudgeVerseRange(first, "start", "shrink")).toBe(false);
    expect(canNudgeVerseRange(first, "end", "shrink")).toBe(false);
    expect(nudgeVerseRange(first, "end", "shrink")).toBeNull();
  });

  it("refuses to grow past the last verse of a short chapter", () => {
    const secondJohnLast = ref(13, 13, "2 John", 1);
    expect(verseRangeBounds(secondJohnLast).max).toBe(13);
    expect(canNudgeVerseRange(secondJohnLast, "end", "grow")).toBe(false);
    expect(nudgeVerseRange(secondJohnLast, "end", "grow")).toBeNull();

    const psalm117Count = getChapterVerseCount("Psalms", 117);
    expect(psalm117Count).toBe(2);
    const psalmLast = ref(2, 2, "Psalms", 117);
    expect(canNudgeVerseRange(psalmLast, "end", "grow")).toBe(false);
    expect(nudgeVerseRange(psalmLast, "end", "grow")).toBeNull();
  });

  it("does not invent a max when the chapter length is unknown", () => {
    const unknown = ref(1, 1, "John", 99);
    expect(verseRangeBounds(unknown).max).toBeNull();
    expect(canNudgeVerseRange(unknown, "end", "grow")).toBe(false);
    expect(nudgeVerseRange(unknown, "end", "grow")).toBeNull();
  });

  it("never skips verses or leaves the chapter", () => {
    const range = ref(15, 17);
    expect(nudgeVerseRange(range, "start", "grow")).toEqual(ref(14, 17));
    expect(nudgeVerseRange(range, "end", "shrink")).toEqual(ref(15, 16));
    expect(nudgeVerseRange(range, "start", "shrink")).toEqual(ref(16, 17));
    expect(nudgeVerseRange(ref(1, 3), "start", "grow")).toBeNull();

    const john1Count = getChapterVerseCount("John", 1);
    expect(john1Count).not.toBeNull();
    const last = ref(john1Count!, john1Count!);
    expect(nudgeVerseRange(last, "end", "grow")).toBeNull();
  });

  it("does not mutate the input or copy scope", () => {
    const original: VerseRef = {
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 16,
      scope: "chapter",
    };
    const snapshot = { ...original };
    const next = nudgeVerseRange(original, "end", "grow");

    expect(original).toEqual(snapshot);
    expect(next).toEqual({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 17,
    });
    expect(next && "scope" in next).toBe(false);
  });
});
