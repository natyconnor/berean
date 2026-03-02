import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEsvPassage } from "@/hooks/use-esv-passage"
import { ChapterHeader } from "@/components/bible/chapter-header"
import { CopyrightNotice } from "@/components/bible/copyright-notice"
import { PassageNavigator } from "@/components/bible/passage-navigator"
import { GospelParallelBanner } from "@/components/links/gospel-parallel-banner"
import { VerseRowWithNotes } from "./view/verse-row-with-notes"
import { usePassageNotesInteraction } from "./hooks/use-passage-notes-interaction"
import { Loader2 } from "lucide-react"

interface PassageViewProps {
  book: string
  chapter: number
}

export function PassageView({ book, chapter }: PassageViewProps) {
  const { data, loading, error } = useEsvPassage(book, chapter)
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

  return (
    <ScrollArea className="h-full">
      <motion.div
        key={passageKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        ref={containerRef}
        className="max-w-6xl mx-auto px-4 pb-16"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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

        <div className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4">
          <GospelParallelBanner book={book} chapter={chapter} />
          <div />
        </div>

        {data.verses.map((verse) => (
          <VerseRowWithNotes
            key={verse.number}
            verseNumber={verse.number}
            text={verse.text}
            selectedVerses={selectedVerses}
            isInSelectionRange={isInSelection(verse.number)}
            isPassageSelection={isPassageSelection}
            singleNotes={singleVerseNotes.get(verse.number) ?? []}
            passageNotes={passageNotesByAnchor.get(verse.number) ?? []}
            passageAnchor={verseToPassageAnchor.get(verse.number)}
            hoveredVerse={hoveredVerse}
            hoveredPassageBubble={hoveredPassageBubble}
            hoveredSingleBubble={hoveredSingleBubble}
            openVerseKey={openVerseKey}
            openPassageKey={openPassageKey}
            creatingFor={creatingFor}
            editingNoteId={editingNoteId}
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
          />
        ))}

        <div className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4">
          <CopyrightNotice text={data.copyright} />
          <div />
        </div>
      </motion.div>
    </ScrollArea>
  )
}
