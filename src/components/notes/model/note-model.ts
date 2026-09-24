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

function cloneNotesByVerse(
  source: Map<number, NoteWithRef[]>,
): Map<number, NoteWithRef[]> {
  const clone = new Map<number, NoteWithRef[]>();
  for (const [verse, notes] of source) {
    clone.set(verse, [...notes]);
  }
  return clone;
}

function takeNoteFromVerseMap(
  map: Map<number, NoteWithRef[]>,
  noteId: Id<"notes">,
): NoteWithRef | null {
  for (const [verse, notes] of map) {
    const index = notes.findIndex((note) => note.noteId === noteId);
    if (index === -1) continue;
    const [note] = notes.splice(index, 1);
    if (notes.length === 0) map.delete(verse);
    return note ?? null;
  }
  return null;
}

function addNoteAtVerse(
  map: Map<number, NoteWithRef[]>,
  verse: number,
  note: NoteWithRef,
) {
  const existing = map.get(verse);
  if (!existing) {
    map.set(verse, [note]);
    return;
  }
  const index = existing.findIndex((entry) => entry.noteId === note.noteId);
  if (index === -1) {
    existing.push(note);
    return;
  }
  existing[index] = note;
}

function verseToPassageAnchorFromPassages(
  passageNotesByAnchor: Map<number, NoteWithRef[]>,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const notes of passageNotesByAnchor.values()) {
    for (const note of notes) {
      const ref = note.verseRef;
      if (ref.startVerse === ref.endVerse) continue;
      for (let verse = ref.startVerse; verse <= ref.endVerse; verse += 1) {
        map.set(verse, ref.startVerse);
      }
    }
  }
  return map;
}

/**
 * Relocate notes whose live/optimistic verseRef no longer matches the
 * server-classified single vs passage maps. Used when a saved single is
 * grown into a span (edit overlay or a just-saved `notes.update`).
 */
export function applyNoteLocationOverrides(
  singleVerseNotes: Map<number, NoteWithRef[]>,
  passageNotesByAnchor: Map<number, NoteWithRef[]>,
  verseToPassageAnchor: Map<number, number>,
  overrides: ReadonlyMap<Id<"notes">, VerseRef>,
): {
  singleVerseNotes: Map<number, NoteWithRef[]>;
  passageNotesByAnchor: Map<number, NoteWithRef[]>;
  verseToPassageAnchor: Map<number, number>;
} {
  if (overrides.size === 0) {
    return {
      singleVerseNotes,
      passageNotesByAnchor,
      verseToPassageAnchor,
    };
  }

  const nextSingles = cloneNotesByVerse(singleVerseNotes);
  const nextPassages = cloneNotesByVerse(passageNotesByAnchor);

  for (const [noteId, nextRef] of overrides) {
    const existing =
      takeNoteFromVerseMap(nextSingles, noteId) ??
      takeNoteFromVerseMap(nextPassages, noteId);
    if (!existing) continue;

    const relocated: NoteWithRef = {
      ...existing,
      verseRef: nextRef,
    };
    if (nextRef.startVerse === nextRef.endVerse) {
      addNoteAtVerse(nextSingles, nextRef.startVerse, relocated);
    } else {
      addNoteAtVerse(nextPassages, nextRef.startVerse, relocated);
    }
  }

  return {
    singleVerseNotes: nextSingles,
    passageNotesByAnchor: nextPassages,
    verseToPassageAnchor: verseToPassageAnchorFromPassages(nextPassages),
  };
}

/** Inclusive highlight span for the notes docked on a passage bubble. */
export function passageHoverSpanForNotes(
  notes: NoteWithRef[],
  overrides?: ReadonlyMap<Id<"notes">, { verseRef: VerseRef }>,
): { startVerse: number; endVerse: number } | null {
  if (notes.length === 0) return null;
  let startVerse = Infinity;
  let endVerse = -Infinity;
  for (const note of notes) {
    const ref = overrides?.get(note.noteId)?.verseRef ?? note.verseRef;
    startVerse = Math.min(startVerse, ref.startVerse);
    endVerse = Math.max(endVerse, ref.endVerse);
  }
  if (!Number.isFinite(startVerse) || !Number.isFinite(endVerse)) return null;
  return { startVerse, endVerse };
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
