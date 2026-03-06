import type { Id } from "../../../../convex/_generated/dataModel"
import type { NoteWithRef } from "@/components/notes/model/note-model"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { isPassageNote } from "@/lib/verse-ref-utils"

export type ComposeLayoutVariant = "current" | "rail" | "drawer"

export interface FilteredVerse {
  verseNumber: number
  text: string
  singleNotes: NoteWithRef[]
  passageNotes: NoteWithRef[]
}

export interface ComposeActiveTarget {
  source: "editing" | "creating" | "open-verse" | "open-passage"
  verseRef: VerseRef
  relatedNotes: NoteWithRef[]
  editingNote: NoteWithRef | null
}

function resolveRelatedNotesForRef(
  verseRef: VerseRef,
  singleVerseNotes: Map<number, NoteWithRef[]>,
  passageNotesByAnchor: Map<number, NoteWithRef[]>
): NoteWithRef[] {
  return isPassageNote(verseRef)
    ? (passageNotesByAnchor.get(verseRef.startVerse) ?? [])
    : (singleVerseNotes.get(verseRef.startVerse) ?? [])
}

interface DeriveComposeActiveTargetArgs {
  book: string
  chapter: number
  editingNoteId: Id<"notes"> | null
  creatingFor: VerseRef | null
  openVerseKey: number | null
  openPassageKey: number | null
  noteById: Map<Id<"notes">, NoteWithRef>
  singleVerseNotes: Map<number, NoteWithRef[]>
  passageNotesByAnchor: Map<number, NoteWithRef[]>
  verseToPassageAnchor: Map<number, number>
}

export function deriveComposeActiveTarget({
  book,
  chapter,
  editingNoteId,
  creatingFor,
  openVerseKey,
  openPassageKey,
  noteById,
  singleVerseNotes,
  passageNotesByAnchor,
  verseToPassageAnchor,
}: DeriveComposeActiveTargetArgs): ComposeActiveTarget | null {
  if (editingNoteId) {
    const editingNote = noteById.get(editingNoteId)
    if (editingNote) {
      return {
        source: "editing",
        verseRef: editingNote.verseRef,
        relatedNotes: resolveRelatedNotesForRef(
          editingNote.verseRef,
          singleVerseNotes,
          passageNotesByAnchor
        ),
        editingNote,
      }
    }
  }

  if (creatingFor) {
    return {
      source: "creating",
      verseRef: creatingFor,
      relatedNotes: resolveRelatedNotesForRef(
        creatingFor,
        singleVerseNotes,
        passageNotesByAnchor
      ),
      editingNote: null,
    }
  }

  if (openPassageKey !== null) {
    const passageNotes = passageNotesByAnchor.get(openPassageKey) ?? []
    return {
      source: "open-passage",
      verseRef:
        passageNotes[0]?.verseRef ?? {
          book,
          chapter,
          startVerse: openPassageKey,
          endVerse: openPassageKey,
        },
      relatedNotes: passageNotes,
      editingNote: null,
    }
  }

  if (openVerseKey !== null) {
    const verseNotes = singleVerseNotes.get(openVerseKey) ?? []
    const passageAnchor = verseToPassageAnchor.get(openVerseKey)
    const linkedPassageNotes =
      passageAnchor !== undefined
        ? (passageNotesByAnchor.get(passageAnchor) ?? [])
        : []
    const relatedNotes = [...verseNotes]
    for (const note of linkedPassageNotes) {
      if (!relatedNotes.some((existing) => existing.noteId === note.noteId)) {
        relatedNotes.push(note)
      }
    }

    return {
      source: "open-verse",
      verseRef:
        verseNotes[0]?.verseRef ??
        linkedPassageNotes[0]?.verseRef ?? {
          book,
          chapter,
          startVerse: openVerseKey,
          endVerse: openVerseKey,
        },
      relatedNotes,
      editingNote: null,
    }
  }

  return null
}
