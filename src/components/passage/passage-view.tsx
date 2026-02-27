import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEsvPassage } from "@/hooks/use-esv-passage"
import { useVerseSelection } from "@/hooks/use-verse-selection"
import { ChapterHeader } from "@/components/bible/chapter-header"
import { CopyrightNotice } from "@/components/bible/copyright-notice"
import { PassageNavigator } from "@/components/bible/passage-navigator"
import { GospelParallelBanner } from "@/components/links/gospel-parallel-banner"
import { VerseRowLeft } from "./verse-row"
import { VerseNotes, PassageNotesBubble, type VerseNote } from "./verse-notes"
import { NoteEditor } from "@/components/notes/note-editor"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VerseRef } from "@/lib/verse-ref-utils"

/** Type guard: narrows search/query union to Doc<"notes"> */
function isNote(doc: unknown): doc is Doc<"notes"> {
  return (
    doc !== null &&
    typeof doc === "object" &&
    "content" in doc &&
    "tags" in doc &&
    "createdAt" in doc
  )
}

interface PassageViewProps {
  book: string
  chapter: number
}

export function PassageView({ book, chapter }: PassageViewProps) {
  const { data, loading, error } = useEsvPassage(book, chapter)

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
  const [openVerseKey, setOpenVerseKey] = useState<number | null>(null)
  const [openPassageKey, setOpenPassageKey] = useState<number | null>(null)
  const [creatingFor, setCreatingFor] = useState<VerseRef | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<Id<"notes"> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset interaction state when navigating to a different passage.
  const [prevBook, setPrevBook] = useState(book)
  const [prevChapter, setPrevChapter] = useState(chapter)
  if (prevBook !== book || prevChapter !== chapter) {
    setPrevBook(book)
    setPrevChapter(chapter)
    setSelectedVerses(new Set())
    setHoveredVerse(null)
    setOpenVerseKey(null)
    setOpenPassageKey(null)
    setCreatingFor(null)
    setEditingNoteId(null)
  }

  // Click-away handler: close open notes when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.querySelector("[data-notes-open]")?.contains(e.target as Node)
      ) {
        setOpenVerseKey(null)
        setOpenPassageKey(null)
        setCreatingFor(null)
        setEditingNoteId(null)
        setSelectedVerses(new Set())
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Single-verse notes only (startVerse === endVerse), keyed by verse number
  const singleVerseNotes = useMemo(() => {
    const map = new Map<number, VerseNote[]>()
    if (!chapterNotes) return map
    for (const entry of chapterNotes) {
      const ref = entry.verseRef
      if (ref.startVerse !== ref.endVerse) continue
      const existing = map.get(ref.startVerse) ?? []
      for (const note of entry.notes) {
        if (!isNote(note)) continue
        if (!existing.some((n) => n.noteId === note._id)) {
          existing.push({
            noteId: note._id,
            content: note.content,
            tags: note.tags,
            verseRef: { book: ref.book, chapter: ref.chapter, startVerse: ref.startVerse, endVerse: ref.endVerse },
            createdAt: note.createdAt,
          })
        }
      }
      map.set(ref.startVerse, existing)
    }
    return map
  }, [chapterNotes])

  // Passage notes only (startVerse !== endVerse), keyed by startVerse (the anchor)
  const passageNotesByAnchor = useMemo(() => {
    const map = new Map<number, VerseNote[]>()
    if (!chapterNotes) return map
    for (const entry of chapterNotes) {
      const ref = entry.verseRef
      if (ref.startVerse === ref.endVerse) continue
      const existing = map.get(ref.startVerse) ?? []
      for (const note of entry.notes) {
        if (!isNote(note)) continue
        if (!existing.some((n) => n.noteId === note._id)) {
          existing.push({
            noteId: note._id,
            content: note.content,
            tags: note.tags,
            verseRef: { book: ref.book, chapter: ref.chapter, startVerse: ref.startVerse, endVerse: ref.endVerse },
            createdAt: note.createdAt,
          })
        }
      }
      map.set(ref.startVerse, existing)
    }
    return map
  }, [chapterNotes])

  // Maps every verse covered by a passage note → that note's startVerse (anchor)
  const verseToPassageAnchor = useMemo(() => {
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
  }, [chapterNotes])

  const handleSelectionComplete = useCallback(
    (selection: { startVerse: number; endVerse: number }) => {
      if (selection.startVerse === selection.endVerse) {
        const v = selection.startVerse
        const singleNotes = singleVerseNotes.get(v) ?? []
        const passageAnchor = verseToPassageAnchor.get(v)

        setSelectedVerses(new Set([v]))
        setEditingNoteId(null)

        if (singleNotes.length > 0) {
          // Verse has its own note → open it; passage note stays closed
          setOpenVerseKey(v)
          setOpenPassageKey(null)
          setCreatingFor(null)
        } else if (passageAnchor === v) {
          // First verse of a passage with no own note → open the passage note
          setOpenPassageKey(v)
          setOpenVerseKey(null)
          setCreatingFor(null)
        } else {
          // No notes yet (or middle verse in a passage) → open creation form for this verse
          setCreatingFor({ book, chapter, startVerse: v, endVerse: v })
          setOpenVerseKey(null)
          setOpenPassageKey(null)
        }
      } else {
        // Multi-verse drag selection → open creation form for a passage note
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
    [book, chapter, singleVerseNotes, verseToPassageAnchor]
  )

  const {
    isInSelection,
    handleMouseDown,
    handleMouseEnter: handleSelectionMouseEnter,
    handleMouseUp: selectionHandleMouseUp,
    clearSelection,
  } = useVerseSelection(handleSelectionComplete)

  // If the verse is already selected, the global mousedown handler will
  // deselect it. Don't start a new drag so mouseup doesn't re-select it.
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

  // For passage range hover highlighting: derive the anchor of the hovered verse's passage
  const hoveredPassageAnchor =
    hoveredVerse !== null ? verseToPassageAnchor.get(hoveredVerse) : undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <ScrollArea className="h-full">
      <div
        ref={containerRef}
        className="max-w-6xl mx-auto px-4 pb-16"
        onMouseUp={selectionHandleMouseUp}
        onMouseLeave={() => { selectionHandleMouseUp(); setHoveredVerse(null) }}
      >
        {/* Header row */}
        <div className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4">
          <div className="flex items-center justify-between">
            <ChapterHeader book={book} chapter={chapter} />
            <PassageNavigator />
          </div>
          <div className="flex items-end pb-4">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </span>
          </div>
        </div>

        {/* Gospel parallels banner */}
        <div className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4">
          <GospelParallelBanner book={book} chapter={chapter} />
          <div />
        </div>

        {/* Verse rows */}
        {data.verses.map((verse) => {
          const singleNotes = singleVerseNotes.get(verse.number) ?? []
          const passageNotes = passageNotesByAnchor.get(verse.number) ?? []
          const passageAnchor = verseToPassageAnchor.get(verse.number)

          const isPassageAnchor = passageNotesByAnchor.has(verse.number)
          const isInPassageRange = passageAnchor !== undefined && !isPassageAnchor
          const isPassageHovered =
            hoveredPassageAnchor !== undefined &&
            verseToPassageAnchor.get(verse.number) === hoveredPassageAnchor

          const isVerseOpen = openVerseKey === verse.number
          const isPassageOpen = openPassageKey === verse.number
          const isCreatingHere = creatingFor?.startVerse === verse.number && !editingNoteId

          const editingSingleNote = editingNoteId
            ? singleNotes.find((n) => n.noteId === editingNoteId)
            : undefined
          const editingPassageNote = editingNoteId
            ? passageNotes.find((n) => n.noteId === editingNoteId)
            : undefined

          const isAnyOpen =
            isVerseOpen ||
            isPassageOpen ||
            isCreatingHere ||
            !!editingSingleNote ||
            !!editingPassageNote

          // Show side-by-side when both zones have collapsed content
          const useRowLayout =
            singleNotes.length > 0 &&
            passageNotes.length > 0 &&
            !isVerseOpen &&
            !isPassageOpen &&
            !isCreatingHere &&
            !editingSingleNote &&
            !editingPassageNote

          const passageNoteJsx = passageNotes.length > 0 && !editingPassageNote ? (
            <PassageNotesBubble
              notes={passageNotes}
              isOpen={isPassageOpen}
              isGlowing={isPassageHovered && !isPassageOpen}
              compact={useRowLayout}
              onOpen={() => {
                setOpenPassageKey(verse.number)
                setSelectedVerses(new Set([verse.number]))
                setCreatingFor(null)
                setEditingNoteId(null)
              }}
              onClose={handleClickAway}
              onEdit={(noteId: Id<"notes">) => {
                setEditingNoteId(noteId)
                setOpenPassageKey(verse.number)
              }}
              onDelete={handleDelete}
              onAddNote={() =>
                setCreatingFor({
                  book: passageNotes[0].verseRef.book,
                  chapter: passageNotes[0].verseRef.chapter,
                  startVerse: passageNotes[0].verseRef.startVerse,
                  endVerse: passageNotes[0].verseRef.endVerse,
                })
              }
            />
          ) : editingPassageNote ? (
            <NoteEditor
              key={`edit-passage-${editingNoteId}`}
              verseRef={editingPassageNote.verseRef}
              initialContent={editingPassageNote.content}
              initialTags={editingPassageNote.tags}
              onSave={handleSaveEdit}
              onCancel={() => setEditingNoteId(null)}
            />
          ) : null

          return (
            <div
              key={verse.number}
              className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4 items-start"
            >
              {/* Left: verse text */}
              <VerseRowLeft
                verseNumber={verse.number}
                text={verse.text}
                isSelected={selectedVerses.has(verse.number)}
                isInSelectionRange={isInSelection(verse.number)}
                hasOwnNote={singleNotes.length > 0}
                isPassageAnchor={isPassageAnchor}
                isInPassageRange={isInPassageRange}
                isPassageHovered={isPassageHovered}
                onAddNote={handleAddNote}
                onMouseDown={handleVerseMouseDown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              />

              {/* Right: notes for this verse */}
              <div
                className={cn("py-1", useRowLayout ? "flex gap-1.5 items-start" : "space-y-1.5")}
                {...(isAnyOpen ? { "data-notes-open": "" } : {})}
              >
                {/* Zone 1: single-verse note */}
                <div className={cn(useRowLayout && "flex-1 min-w-0")}>
                  {editingSingleNote ? (
                    <NoteEditor
                      key={`edit-${editingNoteId}`}
                      verseRef={editingSingleNote.verseRef}
                      initialContent={editingSingleNote.content}
                      initialTags={editingSingleNote.tags}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingNoteId(null)}
                    />
                  ) : singleNotes.length > 0 ? (
                    <VerseNotes
                      notes={singleNotes}
                      isOpen={isVerseOpen}
                      onOpen={() => {
                        setOpenVerseKey(verse.number)
                        setSelectedVerses(new Set([verse.number]))
                        setCreatingFor(null)
                        setEditingNoteId(null)
                      }}
                      onClose={handleClickAway}
                      onEdit={(noteId) => {
                        setEditingNoteId(noteId)
                        setOpenVerseKey(verse.number)
                      }}
                      onDelete={handleDelete}
                      onAddNote={() => handleAddNote(verse.number)}
                    />
                  ) : null}
                </div>

                {/* Zone 2: passage note anchored at this verse */}
                {useRowLayout ? (
                  <div className="w-2/5 shrink-0 min-w-0">{passageNoteJsx}</div>
                ) : (
                  passageNoteJsx
                )}

                {/* Zone 3: creation form */}
                {!editingSingleNote && !editingPassageNote && isCreatingHere && (
                  <NoteEditor
                    key={`create-${creatingFor!.startVerse}-${creatingFor!.endVerse}`}
                    verseRef={creatingFor!}
                    onSave={handleSaveNew}
                    onCancel={handleClickAway}
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Copyright */}
        <div className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4">
          <CopyrightNotice text={data.copyright} />
          <div />
        </div>
      </div>
    </ScrollArea>
  )
}
