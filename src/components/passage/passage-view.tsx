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
import { VerseNotes, type VerseNote } from "./verse-notes"
import { NoteEditor } from "@/components/notes/note-editor"
import { Loader2 } from "lucide-react"
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
  const [openVerseKey, setOpenVerseKey] = useState<number | null>(null)
  const [creatingFor, setCreatingFor] = useState<VerseRef | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<Id<"notes"> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset interaction state when navigating to a different passage.
  // Calling setState during render (not in an effect) is the React-recommended
  // pattern for derived state — React batches these and avoids a second commit.
  const [prevBook, setPrevBook] = useState(book)
  const [prevChapter, setPrevChapter] = useState(chapter)
  if (prevBook !== book || prevChapter !== chapter) {
    setPrevBook(book)
    setPrevChapter(chapter)
    setSelectedVerses(new Set())
    setOpenVerseKey(null)
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
        setCreatingFor(null)
        setEditingNoteId(null)
        setSelectedVerses(new Set())
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Build notes grouped by verse number (anchor to startVerse for passage notes)
  const notesByVerse = useMemo(() => {
    const map = new Map<number, VerseNote[]>()
    if (!chapterNotes) return map
    for (const entry of chapterNotes) {
      const ref = entry.verseRef
      const anchorVerse = ref.startVerse
      const existing = map.get(anchorVerse) ?? []
      for (const note of entry.notes) {
        if (!isNote(note)) continue
        if (!existing.some((n) => n.noteId === note._id)) {
          existing.push({
            noteId: note._id,
            content: note.content,
            tags: note.tags,
            verseRef: {
              book: ref.book,
              chapter: ref.chapter,
              startVerse: ref.startVerse,
              endVerse: ref.endVerse,
            },
            createdAt: note.createdAt,
          })
        }
      }
      map.set(anchorVerse, existing)
    }
    return map
  }, [chapterNotes])

  // Build note count per verse (for dot indicator)
  const verseNoteCounts = useMemo(() => {
    const map = new Map<number, number>()
    if (!chapterNotes) return map
    for (const entry of chapterNotes) {
      const ref = entry.verseRef
      for (let v = ref.startVerse; v <= ref.endVerse; v++) {
        map.set(v, (map.get(v) ?? 0) + entry.notes.length)
      }
    }
    return map
  }, [chapterNotes])

  const handleSelectionComplete = useCallback(
    (selection: { startVerse: number; endVerse: number }) => {
      if (selection.startVerse === selection.endVerse) {
        const v = selection.startVerse
        const notes = notesByVerse.get(v)
        setSelectedVerses(new Set([v]))
        if (notes && notes.length > 0) {
          // Open existing notes
          setOpenVerseKey(v)
          setCreatingFor(null)
          setEditingNoteId(null)
        } else {
          // Open creation form
          setCreatingFor({ book, chapter, startVerse: v, endVerse: v })
          setOpenVerseKey(null)
          setEditingNoteId(null)
        }
      } else {
        // Multi-verse selection: open creation form for passage
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
        setEditingNoteId(null)
      }
    },
    [book, chapter, notesByVerse]
  )

  const {
    isInSelection,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
  } = useVerseSelection(handleSelectionComplete)

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
      setOpenVerseKey(creatingFor.startVerse)
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
    setCreatingFor(null)
    setEditingNoteId(null)
    setSelectedVerses(new Set())
  }, [])

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
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          const notes = notesByVerse.get(verse.number) ?? []
          const isVerseOpen = openVerseKey === verse.number
          const isCreatingHere =
            creatingFor?.startVerse === verse.number && !editingNoteId
          const editingNote =
            editingNoteId && notes.find((n) => n.noteId === editingNoteId)

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
                hasNotes={(verseNoteCounts.get(verse.number) ?? 0) > 0}
                onAddNote={handleAddNote}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
              />

              {/* Right: notes for this verse */}
              <div
                className="py-1"
                {...(editingNote || isCreatingHere || isVerseOpen
                  ? { "data-notes-open": "" }
                  : {})}
              >
                {editingNote ? (
                  <NoteEditor
                    key={`edit-${editingNoteId}`}
                    verseRef={editingNote.verseRef}
                    initialContent={editingNote.content}
                    initialTags={editingNote.tags}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingNoteId(null)}
                  />
                ) : isCreatingHere ? (
                  <NoteEditor
                    key={`create-${creatingFor!.startVerse}-${creatingFor!.endVerse}`}
                    verseRef={creatingFor!}
                    onSave={handleSaveNew}
                    onCancel={handleClickAway}
                  />
                ) : notes.length > 0 ? (
                  <VerseNotes
                    notes={notes}
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
