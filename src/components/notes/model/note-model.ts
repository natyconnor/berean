import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  ChapterNoteEntry,
  NoteSummary,
} from "../../../../convex/lib/publicValues";
import type { NoteBody } from "@/lib/note-inline-content";
import { isChapterScopeRef, type VerseRef } from "@/lib/verse-ref-utils";

export interface NoteWithRef {
  noteId: Id<"notes">;
  content: string;
  body?: NoteBody;
  tags: string[];
  verseRef: VerseRef;
  createdAt: number;
}

function toNoteWithRef(
  note: NoteSummary,
  ref: ChapterNoteEntry["verseRef"],
): NoteWithRef {
  return {
    noteId: note._id,
    content: note.content,
    ...(note.body ? { body: note.body } : {}),
    tags: note.tags,
    verseRef: {
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
      ...(ref.scope === "chapter" ? { scope: "chapter" as const } : {}),
    },
    createdAt: note.createdAt,
  };
}

function isChapterEntry(entry: ChapterNoteEntry): boolean {
  return isChapterScopeRef(entry.verseRef);
}

/** Notes attached to the whole chapter (scope: "chapter"). */
export function buildChapterScopedNotes(
  chapterNotes: ChapterNoteEntry[] | undefined,
): NoteWithRef[] {
  if (!chapterNotes) return [];
  const notes: NoteWithRef[] = [];
  for (const entry of chapterNotes) {
    if (!isChapterEntry(entry)) continue;
    for (const note of entry.notes) {
      if (!notes.some((n) => n.noteId === note._id)) {
        notes.push(toNoteWithRef(note, entry.verseRef));
      }
    }
  }
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

export function buildNotesByVerseRange(
  chapterNotes: ChapterNoteEntry[] | undefined,
): Map<string, NoteWithRef[]> {
  const map = new Map<string, NoteWithRef[]>();
  if (!chapterNotes) return map;

  for (const entry of chapterNotes) {
    if (isChapterEntry(entry)) continue;
    const ref = entry.verseRef;
    const key = `${ref.startVerse}-${ref.endVerse}`;
    const existing = map.get(key) ?? [];
    for (const note of entry.notes) {
      if (!existing.some((n) => n.noteId === note._id)) {
        existing.push(toNoteWithRef(note, ref));
      }
    }
    map.set(key, existing);
  }
  return map;
}

export function buildSingleVerseNotes(
  chapterNotes: ChapterNoteEntry[] | undefined,
): Map<number, NoteWithRef[]> {
  const map = new Map<number, NoteWithRef[]>();
  if (!chapterNotes) return map;

  for (const entry of chapterNotes) {
    if (isChapterEntry(entry)) continue;
    const ref = entry.verseRef;
    if (ref.startVerse !== ref.endVerse) continue;
    const existing = map.get(ref.startVerse) ?? [];
    for (const note of entry.notes) {
      if (!existing.some((n) => n.noteId === note._id)) {
        existing.push(toNoteWithRef(note, ref));
      }
    }
    map.set(ref.startVerse, existing);
  }
  return map;
}

export function buildPassageNotesByAnchor(
  chapterNotes: ChapterNoteEntry[] | undefined,
): Map<number, NoteWithRef[]> {
  const map = new Map<number, NoteWithRef[]>();
  if (!chapterNotes) return map;

  for (const entry of chapterNotes) {
    if (isChapterEntry(entry)) continue;
    const ref = entry.verseRef;
    if (ref.startVerse === ref.endVerse) continue;
    const existing = map.get(ref.startVerse) ?? [];
    for (const note of entry.notes) {
      if (!existing.some((n) => n.noteId === note._id)) {
        existing.push(toNoteWithRef(note, ref));
      }
    }
    map.set(ref.startVerse, existing);
  }
  return map;
}

/** Inclusive verse-range overlap. */
export function verseRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function passageSpanForAnchor(
  anchorVerse: number,
  passageNotesByAnchor: Map<number, NoteWithRef[]>,
): { startVerse: number; endVerse: number } {
  const notes = passageNotesByAnchor.get(anchorVerse) ?? [];
  if (notes.length === 0) {
    return { startVerse: anchorVerse, endVerse: anchorVerse };
  }
  let startVerse = Infinity;
  let endVerse = -Infinity;
  for (const note of notes) {
    startVerse = Math.min(startVerse, note.verseRef.startVerse);
    endVerse = Math.max(endVerse, note.verseRef.endVerse);
  }
  return { startVerse, endVerse };
}

/** Open saved-passage anchors whose span overlaps `[startVerse, endVerse]`. */
export function openPassageAnchorsIntersectingRange(
  openAnchors: Iterable<number>,
  startVerse: number,
  endVerse: number,
  passageNotesByAnchor: Map<number, NoteWithRef[]>,
): number[] {
  const anchors: number[] = [];
  for (const anchor of openAnchors) {
    const span = passageSpanForAnchor(anchor, passageNotesByAnchor);
    if (
      verseRangesOverlap(startVerse, endVerse, span.startVerse, span.endVerse)
    ) {
      anchors.push(anchor);
    }
  }
  return anchors;
}

/**
 * Passage notes whose start verse sits inside a grouped range. Used so a
 * draft (or drag-select) group still shows closed notes whose start was
 * absorbed, instead of dropping them with the swallowed verse row.
 */
export function collectPassageNotesStartingInRange(
  passageNotesByAnchor: Map<number, NoteWithRef[]>,
  startVerse: number,
  endVerse: number,
): NoteWithRef[] {
  const notes: NoteWithRef[] = [];
  const seen = new Set<Id<"notes">>();
  for (let verse = startVerse; verse <= endVerse; verse += 1) {
    const atVerse = passageNotesByAnchor.get(verse);
    if (!atVerse) continue;
    for (const note of atVerse) {
      if (seen.has(note.noteId)) continue;
      seen.add(note.noteId);
      notes.push(note);
    }
  }
  return notes;
}

export function buildVerseToPassageAnchor(
  chapterNotes: ChapterNoteEntry[] | undefined,
): Map<number, number> {
  const map = new Map<number, number>();
  if (!chapterNotes) return map;

  for (const entry of chapterNotes) {
    if (isChapterEntry(entry)) continue;
    const ref = entry.verseRef;
    if (ref.startVerse === ref.endVerse) continue;
    for (let v = ref.startVerse; v <= ref.endVerse; v++) {
      map.set(v, ref.startVerse);
    }
  }
  return map;
}

export function chapterScopeVerseRef(book: string, chapter: number): VerseRef {
  return {
    book,
    chapter,
    startVerse: 1,
    endVerse: 1,
    scope: "chapter",
  };
}
