import { useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEsvPassage } from "@/hooks/use-esv-passage"
import { ChapterHeader } from "@/components/bible/chapter-header"
import { ChapterPager } from "@/components/bible/chapter-pager"
import { CopyrightNotice } from "@/components/bible/copyright-notice"
import { VerseRowWithNotes } from "./view/verse-row-with-notes"
import { usePassageNotesInteraction } from "./hooks/use-passage-notes-interaction"
import { NoteEditor } from "@/components/notes/note-editor"
import type { Id } from "../../../convex/_generated/dataModel"
import type { NoteWithRef } from "@/components/notes/model/note-model"
import { BookOpen, Loader2, Pencil } from "lucide-react"
import { useTabs } from "@/lib/use-tabs"
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation"
import { cn } from "@/lib/utils"
import { usePassageViewMode } from "./hooks/use-passage-view-mode"
import { usePassageKeyboardShortcuts } from "./hooks/use-passage-keyboard-shortcuts"
import { usePassageScrollRestoration } from "./hooks/use-passage-scroll-restoration"
import { usePassageViewTour } from "./hooks/use-passage-view-tour"

interface PassageViewProps {
  book: string
  chapter: number
  focusRange?: { startVerse: number; endVerse: number } | null
  forcedViewMode?: PassageViewMode
  focusSource?: "search"
}

type PassageViewMode = "compose" | "read"
type NoteVisibility = "all" | "noted"

export function PassageView({
  book,
  chapter,
  focusRange = null,
  forcedViewMode,
  focusSource,
}: PassageViewProps) {
  const { data, loading, error } = useEsvPassage(book, chapter)
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>("all")
  const viewportRef = useRef<HTMLDivElement>(null)
  const { navigateActiveTab } = useTabs()
  const { previous, next } = getAdjacentChapterDestinations(book, chapter)
  const {
    containerRef,
    selectedVerses,
    isInSelection,
    isPassageSelection,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    hoveredVerse,
    hoveredPassageBubble,
    hoveredSingleBubble,
    openVerseKey,
    openPassageKey,
    creatingFor,
    editingNoteId,
    handleAddNote,
    handleVerseMouseDown,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseUp,
    handleSingleBubbleMouseEnter,
    handleSingleBubbleMouseLeave,
    handlePassageBubbleMouseEnter,
    handlePassageBubbleMouseLeave,
    openVerseNotes,
    openPassageNotes,
    startEditingNote,
    cancelEditing,
    handleDelete,
    handleSaveEdit,
    handleSaveNew,
    handleClickAway,
    startCreatingPassageNote,
  } = usePassageNotesInteraction(book, chapter)

  const { effectiveViewMode, isReadMode, editorMode, setViewMode } =
    usePassageViewMode({
      focusRange,
      forcedViewMode,
      focusSource,
    })

  const { forceAddButtonVisible, displaySingleVerseNotes } = usePassageViewTour({
    book,
    chapter,
    effectiveViewMode,
    setViewMode,
    singleVerseNotes,
    creatingFor,
    editingNoteId,
    handleClickAway,
    handleAddNote,
  })

  const hasFocusRange =
    typeof focusRange?.startVerse === "number" &&
    typeof focusRange?.endVerse === "number"

  const noteById = useMemo(() => {
    const map = new Map<Id<"notes">, NoteWithRef>()
    for (const notes of displaySingleVerseNotes.values()) {
      for (const note of notes) {
        map.set(note.noteId, note)
      }
    }
    for (const notes of passageNotesByAnchor.values()) {
      for (const note of notes) {
        map.set(note.noteId, note)
      }
    }
    return map
  }, [displaySingleVerseNotes, passageNotesByAnchor])

  const editingNote = editingNoteId
    ? (noteById.get(editingNoteId) ?? null)
    : null

  const hasAnyNotes = noteById.size > 0

  const filteredVerses = useMemo(() => {
    if (!data) return []

    return data.verses.flatMap((verse) => {
      const singleNotes = displaySingleVerseNotes.get(verse.number) ?? []
      const passageNotes = passageNotesByAnchor.get(verse.number) ?? []

      const hasVisibleNotes = singleNotes.length > 0 || passageNotes.length > 0
      if (
        isReadMode &&
        !hasFocusRange &&
        noteVisibility === "noted" &&
        hasAnyNotes &&
        !hasVisibleNotes
      ) {
        return []
      }

      return [
        {
          verseNumber: verse.number,
          text: verse.text,
          singleNotes,
          passageNotes,
        },
      ]
    })
  }, [
    data,
    hasAnyNotes,
    hasFocusRange,
    isReadMode,
    passageNotesByAnchor,
    noteVisibility,
    displaySingleVerseNotes,
  ])

  const shouldShowQuickCaptureDialog =
    isReadMode && (!!creatingFor || !!editingNote)
  const passageGridClass = isReadMode
    ? "grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6"
    : "grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5"
  const topGridClass = cn("grid", passageGridClass)
  const containerClass = isReadMode
    ? "max-w-[1400px] mx-auto px-6 pb-16"
    : "max-w-[1320px] mx-auto px-5 pb-16"
  const focusStartVerse = focusRange?.startVerse
  const focusEndVerse = focusRange?.endVerse
  const focusRequestKey = hasFocusRange
    ? `${book}|${chapter}|${focusStartVerse}|${focusEndVerse}`
    : null
  const focusLayoutKey = focusRequestKey
    ? `${focusRequestKey}|${noteById.size}`
    : null

  usePassageKeyboardShortcuts({
    previous,
    next,
    navigateActiveTab,
    setViewMode,
  })

  const { isScrolled } = usePassageScrollRestoration({
    book,
    chapter,
    focusStartVerse,
    focusRequestKey,
    focusLayoutKey,
    hasData: !!data,
    containerRef,
    viewportRef,
  })

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

  const passageKey = `${book}-${chapter}`

  const headerInnerClass = isReadMode
    ? "max-w-[1400px] mx-auto px-6"
    : "max-w-[1320px] mx-auto px-5"

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div
        className={cn(
          "shrink-0 bg-background transition-shadow duration-200",
          isScrolled && "shadow-sm",
        )}
      >
        <div className={cn("grid", passageGridClass, headerInnerClass)}>
          <div className="flex items-center">
            <ChapterHeader book={book} chapter={chapter} />
          </div>
          <div className="flex flex-col gap-2 pb-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </span>
              <div
                className="inline-flex items-center rounded-md border bg-background p-0.5"
                data-tour-id="passage-view-mode-toggle"
              >
                <Button
                  size="xs"
                  variant={
                    effectiveViewMode === "compose" ? "secondary" : "ghost"
                  }
                  onClick={() => setViewMode("compose")}
                  className="gap-1.5"
                >
                  <Pencil className="h-3 w-3" />
                  Compose
                  <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                    C
                  </kbd>
                </Button>
                <Button
                  size="xs"
                  variant={effectiveViewMode === "read" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("read")}
                  className="gap-1.5"
                >
                  <BookOpen className="h-3 w-3" />
                  Read
                  <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                    R
                  </kbd>
                </Button>
              </div>
            </div>

            {isReadMode &&
              (hasAnyNotes ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show</span>
                  <div className="inline-flex items-center rounded-md border bg-background p-0.5">
                    <Button
                      size="xs"
                      variant={noteVisibility === "all" ? "secondary" : "ghost"}
                      onClick={() => setNoteVisibility("all")}
                    >
                      All Notes
                    </Button>
                    <Button
                      size="xs"
                      variant={
                        noteVisibility === "noted" ? "secondary" : "ghost"
                      }
                      onClick={() => setNoteVisibility("noted")}
                    >
                      Only Noted
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No notes for this chapter
                </p>
              ))}
          </div>
        </div>
      </div>

      <ScrollArea
        className="flex-1 min-h-0 overflow-hidden"
        viewportRef={viewportRef}
      >
        <motion.div
          key={passageKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          ref={containerRef}
          className={containerClass}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div>
            <AnimatePresence initial={false}>
              {filteredVerses.map((verse) => (
                <motion.div
                  key={verse.verseNumber}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "visible" }}
                >
                  <VerseRowWithNotes
                    verseNumber={verse.verseNumber}
                    text={verse.text}
                    viewMode={effectiveViewMode}
                    editorMode={editorMode}
                    currentChapter={{ book, chapter }}
                    selectedVerses={selectedVerses}
                    isInSelectionRange={isInSelection(verse.verseNumber)}
                    isPassageSelection={isPassageSelection}
                    singleNotes={verse.singleNotes}
                    passageNotes={verse.passageNotes}
                    passageAnchor={verseToPassageAnchor.get(verse.verseNumber)}
                    hoveredVerse={hoveredVerse}
                    hoveredPassageBubble={hoveredPassageBubble}
                    hoveredSingleBubble={hoveredSingleBubble}
                    openVerseKey={openVerseKey}
                    openPassageKey={openPassageKey}
                    creatingFor={creatingFor}
                    editingNoteId={editingNoteId}
                    isFocusTarget={
                      hasFocusRange
                        ? verse.verseNumber >= focusRange.startVerse &&
                          verse.verseNumber <= focusRange.endVerse
                        : false
                    }
                    onAddNote={handleAddNote}
                    onMouseDown={handleVerseMouseDown}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onSingleBubbleMouseEnter={handleSingleBubbleMouseEnter}
                    onSingleBubbleMouseLeave={handleSingleBubbleMouseLeave}
                    onPassageBubbleMouseEnter={handlePassageBubbleMouseEnter}
                    onPassageBubbleMouseLeave={handlePassageBubbleMouseLeave}
                    onOpenVerseNotes={openVerseNotes}
                    onOpenPassageNotes={openPassageNotes}
                    onEditNote={startEditingNote}
                    onCancelEditing={cancelEditing}
                  onDelete={handleDelete}
                  onSaveEdit={handleSaveEdit}
                  onSaveNew={handleSaveNew}
                  onClickAway={handleClickAway}
                  onStartCreatingPassageNote={startCreatingPassageNote}
                  forceAddButtonVisible={forceAddButtonVisible && verse.verseNumber === 1}
                  addNoteTourId={verse.verseNumber === 1 ? "passage-add-note" : undefined}
                  rowTourId={verse.verseNumber === 1 ? "passage-verse-1" : undefined}
                />
              </motion.div>
            ))}
            </AnimatePresence>

            <div className={topGridClass}>
              <div>
                <ChapterPager book={book} chapter={chapter} />
                <CopyrightNotice text={data.copyright} />
              </div>
              <div />
            </div>
          </div>

          <Dialog
            open={shouldShowQuickCaptureDialog}
            onOpenChange={(open) => !open && handleClickAway()}
          >
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingNote ? "Edit note" : "Add note"}
                </DialogTitle>
              </DialogHeader>
              {editingNote ? (
                <NoteEditor
                  verseRef={editingNote.verseRef}
                  initialContent={editingNote.content}
                  initialBody={editingNote.body}
                  initialTags={editingNote.tags}
                  presentation="dialog"
                  variant={
                    editingNote.verseRef.startVerse ===
                    editingNote.verseRef.endVerse
                      ? "default"
                      : "passage"
                  }
                  onSave={handleSaveEdit}
                  onCancel={handleClickAway}
                />
              ) : creatingFor ? (
                <NoteEditor
                  verseRef={creatingFor}
                  presentation="dialog"
                  variant={
                    creatingFor.startVerse === creatingFor.endVerse
                      ? "default"
                      : "passage"
                  }
                  onSave={handleSaveNew}
                  onCancel={handleClickAway}
                />
              ) : null}
            </DialogContent>
          </Dialog>
        </motion.div>
      </ScrollArea>
    </div>
  )
}
