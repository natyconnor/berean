import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  collectPassageNotesStartingInRange,
  openPassageAnchorsIntersectingRange,
  verseRangesOverlap,
  type NoteWithRef,
} from "./note-model";

function passageNote(
  startVerse: number,
  endVerse: number,
  noteId = `note-${startVerse}-${endVerse}`,
): NoteWithRef {
  return {
    noteId: noteId as Id<"notes">,
    content: `${startVerse}-${endVerse}`,
    tags: [],
    verseRef: {
      book: "John",
      chapter: 1,
      startVerse,
      endVerse,
    },
    createdAt: 1,
  };
}

describe("verseRangesOverlap", () => {
  it("treats 4–11 and 7–15 as overlapping and 4–11 and 12–15 as not", () => {
    expect(verseRangesOverlap(4, 11, 7, 15)).toBe(true);
    expect(verseRangesOverlap(4, 11, 12, 15)).toBe(false);
    expect(verseRangesOverlap(4, 12, 12, 15)).toBe(true);
  });
});

describe("openPassageAnchorsIntersectingRange", () => {
  it("returns open saved anchors whose span intersects the draft", () => {
    const saved715 = passageNote(7, 15);
    const byAnchor = new Map([[7, [saved715]]]);

    expect(
      openPassageAnchorsIntersectingRange(new Set([7]), 4, 11, byAnchor),
    ).toEqual([7]);
    expect(
      openPassageAnchorsIntersectingRange(new Set([7]), 4, 6, byAnchor),
    ).toEqual([]);
  });
});

describe("collectPassageNotesStartingInRange", () => {
  it("docks a closed saved note when the group covers its start verse", () => {
    const closed1215 = passageNote(12, 15);
    const byAnchor = new Map([[12, [closed1215]]]);

    expect(collectPassageNotesStartingInRange(byAnchor, 4, 11)).toEqual([]);
    expect(collectPassageNotesStartingInRange(byAnchor, 4, 12)).toEqual([
      closed1215,
    ]);
  });

  it("keeps notes at the group anchor and skips starts outside the span", () => {
    const at4 = passageNote(4, 6);
    const at7 = passageNote(7, 15);
    const at16 = passageNote(16, 18);
    const byAnchor = new Map([
      [4, [at4]],
      [7, [at7]],
      [16, [at16]],
    ]);

    expect(collectPassageNotesStartingInRange(byAnchor, 4, 11)).toEqual([
      at4,
      at7,
    ]);
  });
});
