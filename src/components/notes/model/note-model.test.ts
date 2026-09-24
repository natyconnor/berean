import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  applyNoteLocationOverrides,
  collectPassageNotesStartingInRange,
  openPassageAnchorsIntersectingRange,
  passageHoverSpanForNotes,
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

describe("applyNoteLocationOverrides", () => {
  it("moves a saved single into a passage span and rebuilds hover anchors", () => {
    const note = passageNote(12, 12, "note-12");
    const singles = new Map([[12, [note]]]);
    const passages = new Map<number, NoteWithRef[]>();
    const nextRef = {
      book: "John",
      chapter: 1,
      startVerse: 12,
      endVerse: 13,
    } as const;

    const resolved = applyNoteLocationOverrides(
      singles,
      passages,
      new Map(),
      new Map([[note.noteId, nextRef]]),
    );

    expect(resolved.singleVerseNotes.get(12)).toBeUndefined();
    expect(resolved.passageNotesByAnchor.get(12)).toEqual([
      { ...note, verseRef: nextRef },
    ]);
    expect(resolved.verseToPassageAnchor.get(12)).toBe(12);
    expect(resolved.verseToPassageAnchor.get(13)).toBe(12);
  });

  it("leaves live maps untouched when there are no overrides", () => {
    const note = passageNote(12, 13);
    const singles = new Map<number, NoteWithRef[]>();
    const passages = new Map([[12, [note]]]);
    const anchors = new Map([
      [12, 12],
      [13, 12],
    ]);

    const resolved = applyNoteLocationOverrides(
      singles,
      passages,
      anchors,
      new Map(),
    );

    expect(resolved.singleVerseNotes).toBe(singles);
    expect(resolved.passageNotesByAnchor).toBe(passages);
    expect(resolved.verseToPassageAnchor).toBe(anchors);
  });
});

describe("passageHoverSpanForNotes", () => {
  it("uses the live span for a retargeted passage note", () => {
    expect(passageHoverSpanForNotes([passageNote(12, 13)])).toEqual({
      startVerse: 12,
      endVerse: 13,
    });
  });

  it("uses an optimistic override span when the row is still the old single", () => {
    const note = passageNote(12, 12, "note-12");
    expect(
      passageHoverSpanForNotes(
        [note],
        new Map([
          [
            note.noteId,
            {
              verseRef: {
                book: "John",
                chapter: 1,
                startVerse: 12,
                endVerse: 13,
              },
            },
          ],
        ]),
      ),
    ).toEqual({ startVerse: 12, endVerse: 13 });
  });
});
