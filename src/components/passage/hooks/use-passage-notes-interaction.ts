import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { useVerseSelection } from "@/hooks/use-verse-selection"
import type { VerseRef } from "@/lib/verse-ref-utils"
import {
  buildSingleVerseNotes,
  buildPassageNotesByAnchor,
  buildVerseToPassageAnchor,
  type ChapterNoteEntry,
  type NoteWithRef,
} from "@/components/notes/model/note-model"

export interface PassageNotesInteraction {
  selectedVerses: Set<number>
  hoveredVerse: number | null
  hoveredSingleBubble: number | null
  hoveredPassageBubble: number | null
  openVerseKey: number | null
  openPassageKey: number | null
  creatingFor: VerseRef | null
  editingNoteId: Id<"notes"> | null
  isPassageSelection: boolean

  singleVerseNotes: Map<number, NoteWithRef[]>
  passageNotesByAnchor: Map<number, NoteWithRef[]>
  verseToPassageAnchor: Map<number, number>

  containerRef: React.RefObject<HTMLDivElement | null>
  isInSelection: (verseNumber: number) => boolean

  handleVerseMouseDown: (verseNumber: number) => void
  handleMouseEnter: (verseNumber: number) => void
  handleMouseLeave: () => void
  handleMouseUp: () => void
  handleSingleBubbleMouseEnter: (verseNumber: number) => void
  handleSingleBubbleMouseLeave: () => void
  handlePassageBubbleMouseEnter: (verseNumber: number) => void
  handlePassageBubbleMouseLeave: () => void
  handleAddNote: (verseNumber: number) => void
  handleSaveNew: (content: string, tags: string[]) => Promise<void>
  handleSaveEdit: (content: string, tags: string[]) => Promise<void>
  handleDelete: (noteId: Id<"notes">) => Promise<void>
  handleClickAway: () => void
  openVerseNotes: (verseNumber: number) => void
  openPassageNotes: (verseNumber: number) => void
  startEditingNote: (noteId: Id<"notes">, verseNumber: number, isPassage: boolean) => void
  cancelEditing: () => void
  startCreatingPassageNote: (verseRef: VerseRef) => void
}

export function usePassageNotesInteraction(
  book: string,
  chapter: number
): PassageNotesInteraction {
  const chapterNotes = useQuery(api.noteVerseLinks.getNotesForChapter, {
    book,
    chapter,
  })
  const createNote = useMutation(api.notes.create)
  const updateNote = useMutation(api.notes.update)
  const removeNote = useMutation(api.notes.remove)
  const findOrCreateRef = useMutation(api.verseRefs.findOrCreate)
  const linkNote = useMutation(api.noteVerseLinks.link)

  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set())
  const [hoveredVerse, setHoveredVerse] = useState<number | null>(null)
  const [hoveredSingleBubble, setHoveredSingleBubble] = useState<number | null>(null)
  const [hoveredPassageBubble, setHoveredPassageBubble] = useState<number | null>(null)
  const [openVerseKey, setOpenVerseKey] = useState<number | null>(null)
  const [openPassageKey, setOpenPassageKey] = useState<number | null>(null)
  const [creatingFor, setCreatingFor] = useState<VerseRef | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<Id<"notes"> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const suppressNextDocumentClickRef = useRef(false)

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional reset on prop change */
  useEffect(() => {
    setSelectedVerses(new Set())
    setHoveredVerse(null)
    setHoveredSingleBubble(null)
    setHoveredPassageBubble(null)
    setOpenVerseKey(null)
    setOpenPassageKey(null)
    setCreatingFor(null)
    setEditingNoteId(null)
  }, [book, chapter])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (suppressNextDocumentClickRef.current) {
        suppressNextDocumentClickRef.current = false
        return
      }

      const path = e.composedPath()
      const hasSelectorInPath = (selector: string) =>
        path.some((node) => node instanceof Element && node.matches(selector))
      const isInteractiveTarget =
        hasSelectorInPath("[data-note-trigger]") ||
        hasSelectorInPath("[data-note-surface]") ||
        hasSelectorInPath("[data-verse-number]")

      // Interactive targets (verse rows, note triggers, note surfaces) manage
      // their own state. Any other click should act as click-away.
      if (!isInteractiveTarget) {
        setOpenVerseKey(null)
        setOpenPassageKey(null)
        setCreatingFor(null)
        setEditingNoteId(null)
        setSelectedVerses(new Set())
      }
    }
    document.addEventListener("click", handleOutsideClick)
    return () => document.removeEventListener("click", handleOutsideClick)
  }, [])

  const singleVerseNotes = useMemo(
    () => buildSingleVerseNotes(chapterNotes as ChapterNoteEntry[] | undefined),
    [chapterNotes]
  )

  const passageNotesByAnchor = useMemo(
    () => buildPassageNotesByAnchor(chapterNotes as ChapterNoteEntry[] | undefined),
    [chapterNotes]
  )

  const verseToPassageAnchor = useMemo(
    () => buildVerseToPassageAnchor(chapterNotes as ChapterNoteEntry[] | undefined),
    [chapterNotes]
  )

  const getSelectedVersesForPassageAnchor = useCallback(
    (anchorVerse: number) => {
      const passageNotes = passageNotesByAnchor.get(anchorVerse) ?? []
      if (passageNotes.length === 0) {
        return new Set([anchorVerse])
      }

      const verses = new Set<number>()
      for (const note of passageNotes) {
        const { startVerse, endVerse } = note.verseRef
        for (let v = startVerse; v <= endVerse; v++) {
          verses.add(v)
        }
      }
      return verses
    },
    [passageNotesByAnchor]
  )

  const handleSelectionComplete = useCallback(
    (selection: { startVerse: number; endVerse: number }) => {
      if (selection.startVerse === selection.endVerse) {
        const v = selection.startVerse
        const singleNotes = singleVerseNotes.get(v) ?? []
        const passageAnchor = verseToPassageAnchor.get(v)

        setEditingNoteId(null)

        if (singleNotes.length > 0) {
          setSelectedVerses(new Set([v]))
          setOpenVerseKey(v)
          setOpenPassageKey(null)
          setCreatingFor(null)
        } else if (passageAnchor === v) {
          setSelectedVerses(getSelectedVersesForPassageAnchor(v))
          setOpenPassageKey(v)
          setOpenVerseKey(null)
          setCreatingFor(null)
        } else {
          setSelectedVerses(new Set([v]))
          setCreatingFor({ book, chapter, startVerse: v, endVerse: v })
          setOpenVerseKey(null)
          setOpenPassageKey(null)
        }
      } else {
        const verses = new Set<number>()
        for (let v = selection.startVerse; v <= selection.endVerse; v++) {
          verses.add(v)
        }
        setSelectedVerses(verses)
        setCreatingFor({
          book,
          chapter,
          startVerse: selection.startVerse,
          endVerse: selection.endVerse,
        })
        setOpenVerseKey(null)
        setOpenPassageKey(null)
        setEditingNoteId(null)
      }
    },
    [book, chapter, getSelectedVersesForPassageAnchor, singleVerseNotes, verseToPassageAnchor]
  )

  const {
    isInSelection,
    handleMouseDown,
    handleMouseEnter: handleSelectionMouseEnter,
    handleMouseUp: selectionHandleMouseUp,
    clearSelection,
  } = useVerseSelection(handleSelectionComplete)

  const handleVerseMouseDown = useCallback(
    (verseNumber: number) => {
      if (selectedVerses.has(verseNumber)) return
      handleMouseDown(verseNumber)
    },
    [selectedVerses, handleMouseDown]
  )

  const handleMouseEnter = useCallback(
    (verseNumber: number) => {
      setHoveredVerse(verseNumber)
      handleSelectionMouseEnter(verseNumber)
    },
    [handleSelectionMouseEnter]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredVerse(null)
  }, [])

  const handleMouseUp = useCallback(() => {
    const didCompleteSelection = selectionHandleMouseUp()
    if (didCompleteSelection) {
      suppressNextDocumentClickRef.current = true
    }
    setHoveredVerse(null)
  }, [selectionHandleMouseUp])

  const handleSingleBubbleMouseEnter = useCallback((verseNumber: number) => {
    setHoveredSingleBubble(verseNumber)
  }, [])

  const handleSingleBubbleMouseLeave = useCallback(() => {
    setHoveredSingleBubble(null)
  }, [])

  const handlePassageBubbleMouseEnter = useCallback((verseNumber: number) => {
    setHoveredPassageBubble(verseNumber)
  }, [])

  const handlePassageBubbleMouseLeave = useCallback(() => {
    setHoveredPassageBubble(null)
  }, [])

  const handleAddNote = useCallback(
    (verseNumber: number) => {
      setCreatingFor({
        book,
        chapter,
        startVerse: verseNumber,
        endVerse: verseNumber,
      })
      setSelectedVerses(new Set([verseNumber]))
      setOpenVerseKey(null)
      setOpenPassageKey(null)
      setEditingNoteId(null)
    },
    [book, chapter]
  )

  const handleSaveNew = useCallback(
    async (content: string, tags: string[]) => {
      if (!creatingFor) return
      const noteId = await createNote({ content, tags })
      const verseRefId = await findOrCreateRef({
        book: creatingFor.book,
        chapter: creatingFor.chapter,
        startVerse: creatingFor.startVerse,
        endVerse: creatingFor.endVerse,
      })
      await linkNote({ noteId, verseRefId })
      setCreatingFor(null)
      setSelectedVerses(new Set())
      if (creatingFor.startVerse !== creatingFor.endVerse) {
        setOpenPassageKey(creatingFor.startVerse)
        setOpenVerseKey(null)
      } else {
        setOpenVerseKey(creatingFor.startVerse)
        setOpenPassageKey(null)
      }
    },
    [creatingFor, createNote, findOrCreateRef, linkNote]
  )

  const handleSaveEdit = useCallback(
    async (content: string, tags: string[]) => {
      if (!editingNoteId) return
      await updateNote({ id: editingNoteId, content, tags })
      setEditingNoteId(null)
    },
    [editingNoteId, updateNote]
  )

  const handleDelete = useCallback(
    async (noteId: Id<"notes">) => {
      await removeNote({ id: noteId })
    },
    [removeNote]
  )

  const handleClickAway = useCallback(() => {
    setOpenVerseKey(null)
    setOpenPassageKey(null)
    setCreatingFor(null)
    setEditingNoteId(null)
    setSelectedVerses(new Set())
    clearSelection()
  }, [clearSelection])

  useEffect(() => {
    function handleEscapeKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (
        openVerseKey === null &&
        openPassageKey === null &&
        creatingFor === null &&
        editingNoteId === null &&
        selectedVerses.size === 0
      ) {
        return
      }
      handleClickAway()
    }

    document.addEventListener("keydown", handleEscapeKey)
    return () => document.removeEventListener("keydown", handleEscapeKey)
  }, [
    creatingFor,
    editingNoteId,
    handleClickAway,
    openPassageKey,
    openVerseKey,
    selectedVerses,
  ])

  const openVerseNotes = useCallback((verseNumber: number) => {
    setOpenVerseKey(verseNumber)
    setOpenPassageKey(null)
    setSelectedVerses(new Set([verseNumber]))
    setCreatingFor(null)
    setEditingNoteId(null)
  }, [])

  const openPassageNotes = useCallback((verseNumber: number) => {
    setOpenPassageKey(verseNumber)
    setOpenVerseKey(null)
    setSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber))
    setCreatingFor(null)
    setEditingNoteId(null)
  }, [getSelectedVersesForPassageAnchor])

  const startEditingNote = useCallback(
    (noteId: Id<"notes">, verseNumber: number, isPassage: boolean) => {
      setEditingNoteId(noteId)
      if (isPassage) {
        setOpenPassageKey(verseNumber)
        setOpenVerseKey(null)
        setSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber))
      } else {
        setOpenVerseKey(verseNumber)
        setOpenPassageKey(null)
        setSelectedVerses(new Set([verseNumber]))
      }
    },
    [getSelectedVersesForPassageAnchor]
  )

  const cancelEditing = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  const startCreatingPassageNote = useCallback((verseRef: VerseRef) => {
    setCreatingFor(verseRef)
  }, [])

  const isPassageSelection = creatingFor
    ? creatingFor.startVerse !== creatingFor.endVerse
    : selectedVerses.size > 1

  return {
    selectedVerses,
    hoveredVerse,
    hoveredSingleBubble,
    hoveredPassageBubble,
    openVerseKey,
    openPassageKey,
    creatingFor,
    editingNoteId,
    isPassageSelection,

    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,

    containerRef,
    isInSelection,

    handleVerseMouseDown,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseUp,
    handleSingleBubbleMouseEnter,
    handleSingleBubbleMouseLeave,
    handlePassageBubbleMouseEnter,
    handlePassageBubbleMouseLeave,
    handleAddNote,
    handleSaveNew,
    handleSaveEdit,
    handleDelete,
    handleClickAway,
    openVerseNotes,
    openPassageNotes,
    startEditingNote,
    cancelEditing,
    startCreatingPassageNote,
  }
}
