import { useEffect, useMemo } from "react"
import { useTutorial } from "@/components/tutorial/tutorial-context"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { NoteWithRef } from "@/components/notes/model/note-model"
import type { VerseRef } from "@/lib/verse-ref-utils"

type PassageViewMode = "compose" | "read"

const TUTORIAL_READING_PREVIEWS = [
  "John opens with Jesus already present before creation.",
  "The light keeps breaking into darkness without being overcome.",
  "John the Baptist points away from himself toward the true light.",
  "The Word arrives in the world he made, and many still miss him.",
  "Receiving Jesus is pictured as a new birth from God.",
  "Grace and truth arrive in fullness through the Word made flesh.",
  "John keeps centering his witness on someone greater than himself.",
  "The first chapter keeps building expectancy around who Jesus is.",
  "Every scene pushes the reader toward recognition and response.",
  "Reading mode gives your notes room to breathe beside the passage.",
]

function buildTutorialReadingNotes(book: string, chapter: number): Map<number, NoteWithRef[]> {
  return new Map(
    TUTORIAL_READING_PREVIEWS.map((content, index) => {
      const verseNumber = index + 1
      return [
        verseNumber,
        [
          {
            noteId: `tutorial-reading-${verseNumber}` as Id<"notes">,
            content,
            tags: [],
            verseRef: { book, chapter, startVerse: verseNumber, endVerse: verseNumber },
            createdAt: 0,
          },
        ],
      ]
    }),
  )
}

interface UsePassageViewTourParams {
  book: string
  chapter: number
  effectiveViewMode: PassageViewMode
  setViewMode: (mode: PassageViewMode) => void
  singleVerseNotes: Map<number, NoteWithRef[]>
  creatingFor: VerseRef | null
  editingNoteId: Id<"notes"> | null
  handleClickAway: () => void
  handleAddNote: (verse: number) => void
}

export interface PassageViewTourState {
  forceAddButtonVisible: boolean
  displaySingleVerseNotes: Map<number, NoteWithRef[]>
}

export function usePassageViewTour({
  book,
  chapter,
  effectiveViewMode,
  setViewMode,
  singleVerseNotes,
  creatingFor,
  editingNoteId,
  handleClickAway,
  handleAddNote,
}: UsePassageViewTourParams): PassageViewTourState {
  const { activeStep, activeTour } = useTutorial()

  const isAddNoteStep = activeTour === "main" && activeStep?.id === "add-note"
  const isNoteEditorStep =
    activeTour === "main" &&
    (activeStep?.id === "note-body" ||
      activeStep?.id === "note-tags" ||
      activeStep?.id === "inline-links")
  const isReadingModeStep = activeTour === "main" && activeStep?.id === "reading-mode"

  useEffect(() => {
    if (!(isAddNoteStep || isNoteEditorStep)) return
    if (effectiveViewMode !== "compose") {
      setViewMode("compose")
    }
  }, [effectiveViewMode, setViewMode, isAddNoteStep, isNoteEditorStep])

  useEffect(() => {
    if (!isAddNoteStep) return
    handleClickAway()
  }, [handleClickAway, isAddNoteStep])

  useEffect(() => {
    if (!isNoteEditorStep) return

    const isAlreadyVerseOneEditor =
      creatingFor?.startVerse === 1 && creatingFor.endVerse === 1
    if (!isAlreadyVerseOneEditor || editingNoteId !== null) {
      handleAddNote(1)
    }
  }, [creatingFor, editingNoteId, handleAddNote, isNoteEditorStep])

  useEffect(() => {
    if (!isReadingModeStep) return
    handleClickAway()
    if (effectiveViewMode !== "read") {
      setViewMode("read")
    }
  }, [effectiveViewMode, handleClickAway, isReadingModeStep, setViewMode])

  const tutorialReadingNotes =
    isReadingModeStep && book === "John" && chapter === 1
      ? buildTutorialReadingNotes(book, chapter)
      : null

  const displaySingleVerseNotes = useMemo(
    () => tutorialReadingNotes ?? singleVerseNotes,
    [tutorialReadingNotes, singleVerseNotes],
  )

  return {
    forceAddButtonVisible: isAddNoteStep,
    displaySingleVerseNotes,
  }
}
