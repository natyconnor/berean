import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import type { NoteBody } from "@/lib/note-inline-content"
import type { VerseRef } from "@/lib/verse-ref-utils"

export interface NoteWithRef {
  noteId: Id<"notes">
  content: string
  body?: NoteBody
  tags: string[]
  verseRef: VerseRef
  createdAt: number
}

export function isNote(doc: unknown): doc is Doc<"notes"> {
  return (
    doc !== null &&
    typeof doc === "object" &&
    "content" in doc &&
    "tags" in doc &&
    "createdAt" in doc
  )
}

export interface ChapterNoteEntry {
  verseRef: {
    book: string
    chapter: number
    startVerse: number
    endVerse: number
  }
  notes: unknown[]
}

function toNoteWithRef(note: Doc<"notes">, ref: ChapterNoteEntry["verseRef"]): NoteWithRef {
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
    },
    createdAt: note.createdAt,
  }
}

export function buildNotesByVerseRange(
  chapterNotes: ChapterNoteEntry[] | undefined
): Map<string, NoteWithRef[]> {
  const map = new Map<string, NoteWithRef[]>()
  if (!chapterNotes) return map

  for (const entry of chapterNotes) {
    const ref = entry.verseRef
    const key = `${ref.startVerse}-${ref.endVerse}`
    const existing = map.get(key) ?? []
    for (const note of entry.notes) {
      if (!isNote(note)) continue
      if (!existing.some((n) => n.noteId === note._id)) {
        existing.push(toNoteWithRef(note, ref))
      }
    }
    map.set(key, existing)
  }
  return map
}

export function buildSingleVerseNotes(
  chapterNotes: ChapterNoteEntry[] | undefined
): Map<number, NoteWithRef[]> {
  const map = new Map<number, NoteWithRef[]>()
  if (!chapterNotes) return map

  for (const entry of chapterNotes) {
    const ref = entry.verseRef
    if (ref.startVerse !== ref.endVerse) continue
    const existing = map.get(ref.startVerse) ?? []
    for (const note of entry.notes) {
      if (!isNote(note)) continue
      if (!existing.some((n) => n.noteId === note._id)) {
        existing.push(toNoteWithRef(note, ref))
      }
    }
    map.set(ref.startVerse, existing)
  }
  return map
}

export function buildPassageNotesByAnchor(
  chapterNotes: ChapterNoteEntry[] | undefined
): Map<number, NoteWithRef[]> {
  const map = new Map<number, NoteWithRef[]>()
  if (!chapterNotes) return map

  for (const entry of chapterNotes) {
    const ref = entry.verseRef
    if (ref.startVerse === ref.endVerse) continue
    const existing = map.get(ref.startVerse) ?? []
    for (const note of entry.notes) {
      if (!isNote(note)) continue
      if (!existing.some((n) => n.noteId === note._id)) {
        existing.push(toNoteWithRef(note, ref))
      }
    }
    map.set(ref.startVerse, existing)
  }
  return map
}

export function buildVerseToPassageAnchor(
  chapterNotes: ChapterNoteEntry[] | undefined
): Map<number, number> {
  const map = new Map<number, number>()
  if (!chapterNotes) return map

  for (const entry of chapterNotes) {
    const ref = entry.verseRef
    if (ref.startVerse === ref.endVerse) continue
    for (let v = ref.startVerse; v <= ref.endVerse; v++) {
      map.set(v, ref.startVerse)
    }
  }
  return map
}
