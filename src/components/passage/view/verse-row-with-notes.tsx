import { memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Id } from "../../../../convex/_generated/dataModel"
import { VerseRowLeft } from "../verse-row"
import { VerseNotes, PassageNotesBubble } from "../verse-notes"
import { NoteEditor } from "@/components/notes/note-editor"
import { cn } from "@/lib/utils"
import type { VerseRef } from "@/lib/verse-ref-utils"
import type { NoteWithRef } from "@/components/notes/model/note-model"

const layoutTransition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }

export interface VerseRowWithNotesProps {
  verseNumber: number
  text: string

  selectedVerses: Set<number>
  isInSelectionRange: boolean
  isPassageSelection: boolean

  singleNotes: NoteWithRef[]
  passageNotes: NoteWithRef[]
  passageAnchor: number | undefined

  hoveredVerse: number | null
  hoveredPassageBubble: number | null
  hoveredSingleBubble: number | null

  openVerseKey: number | null
  openPassageKey: number | null
  creatingFor: VerseRef | null
  editingNoteId: Id<"notes"> | null

  onAddNote: (verseNumber: number) => void
  onMouseDown: (verseNumber: number) => void
  onMouseEnter: (verseNumber: number) => void
  onMouseLeave: () => void
  onSingleBubbleMouseEnter: (verseNumber: number) => void
  onSingleBubbleMouseLeave: () => void
  onPassageBubbleMouseEnter: (verseNumber: number) => void
  onPassageBubbleMouseLeave: () => void
  onOpenVerseNotes: (verseNumber: number) => void
  onOpenPassageNotes: (verseNumber: number) => void
  onEditNote: (noteId: Id<"notes">, verseNumber: number, isPassage: boolean) => void
  onCancelEditing: () => void
  onDelete: (noteId: Id<"notes">) => Promise<void>
  onSaveEdit: (content: string, tags: string[]) => Promise<void>
  onSaveNew: (content: string, tags: string[]) => Promise<void>
  onClickAway: () => void
  onStartCreatingPassageNote: (verseRef: VerseRef) => void
}

export const VerseRowWithNotes = memo(function VerseRowWithNotes({
  verseNumber,
  text,
  selectedVerses,
  isInSelectionRange,
  isPassageSelection,
  singleNotes,
  passageNotes,
  passageAnchor,
  hoveredVerse,
  hoveredPassageBubble,
  hoveredSingleBubble,
  openVerseKey,
  openPassageKey,
  creatingFor,
  editingNoteId,
  onAddNote,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onSingleBubbleMouseEnter,
  onSingleBubbleMouseLeave,
  onPassageBubbleMouseEnter,
  onPassageBubbleMouseLeave,
  onOpenVerseNotes,
  onOpenPassageNotes,
  onEditNote,
  onCancelEditing,
  onDelete,
  onSaveEdit,
  onSaveNew,
  onClickAway,
  onStartCreatingPassageNote,
}: VerseRowWithNotesProps) {
  const isPassageAnchor = passageNotes.length > 0
  const isInPassageRange = passageAnchor !== undefined && !isPassageAnchor

  const isPassageRangeActive =
    passageAnchor !== undefined &&
    (hoveredVerse === passageAnchor || hoveredPassageBubble === passageAnchor)

  const isNoteBubbleHovered =
    hoveredSingleBubble === verseNumber || hoveredPassageBubble === verseNumber

  const isVerseOpen = openVerseKey === verseNumber
  const isPassageOpen = openPassageKey === verseNumber
  const isCreatingHere = creatingFor?.startVerse === verseNumber && !editingNoteId

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

  const hasBothNoteTypes = singleNotes.length > 0 && passageNotes.length > 0
  const useSideBySide = hasBothNoteTypes && !isCreatingHere && !editingSingleNote && !editingPassageNote
  const showVerseAsPill = useSideBySide && isPassageOpen
  const showPassageCompact = useSideBySide && !isPassageOpen

  const passageNoteJsx = (
    <AnimatePresence initial={false}>
      {passageNotes.length > 0 && !editingPassageNote ? (
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.15 }, layout: layoutTransition }}
          className={cn(useSideBySide && (isPassageOpen ? "flex-1 min-w-[240px]" : "w-[140px] shrink-0"))}
        >
          <PassageNotesBubble
            notes={passageNotes}
            isOpen={isPassageOpen}
            isGlowing={isPassageRangeActive}
            compact={showPassageCompact}
            onOpen={() => onOpenPassageNotes(verseNumber)}
            onClose={onClickAway}
            onEdit={(noteId: Id<"notes">) => onEditNote(noteId, verseNumber, true)}
            onDelete={onDelete}
            onAddNote={() =>
              onStartCreatingPassageNote({
                book: passageNotes[0].verseRef.book,
                chapter: passageNotes[0].verseRef.chapter,
                startVerse: passageNotes[0].verseRef.startVerse,
                endVerse: passageNotes[0].verseRef.endVerse,
              })
            }
            onMouseEnter={() => onPassageBubbleMouseEnter(verseNumber)}
            onMouseLeave={onPassageBubbleMouseLeave}
          />
        </motion.div>
      ) : editingPassageNote ? (
        <motion.div
          key={`edit-passage-${editingNoteId}`}
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <NoteEditor
            verseRef={editingPassageNote.verseRef}
            initialContent={editingPassageNote.content}
            initialTags={editingPassageNote.tags}
            variant="passage"
            onSave={onSaveEdit}
            onCancel={onCancelEditing}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return (
    <motion.div
      layout="position"
      transition={{ layout: layoutTransition }}
      className="grid grid-cols-[1fr_minmax(280px,360px)] gap-4 items-start"
    >
      <motion.div layout="position" transition={{ layout: layoutTransition }}>
        <VerseRowLeft
          verseNumber={verseNumber}
          text={text}
          selection={{
            isSelected: selectedVerses.has(verseNumber),
            isInSelectionRange,
            isPassageSelection,
          }}
          noteIndicator={{
            hasOwnNote: singleNotes.length > 0,
            isPassageAnchor,
            isInPassageRange,
          }}
          hover={{
            isPassageRangeActive,
            isNoteBubbleHovered,
          }}
          handlers={{
            onAddNote,
            onMouseDown,
            onMouseEnter,
            onMouseLeave,
          }}
        />
      </motion.div>

      <motion.div
        layout
        transition={{ layout: layoutTransition }}
        className={cn("py-1", useSideBySide ? "flex gap-2 items-start" : "space-y-1.5")}
        {...(isAnyOpen ? { "data-notes-open": "" } : {})}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {editingSingleNote ? (
            <motion.div
              key={`edit-${editingNoteId}`}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-w-0"
            >
              <NoteEditor
                verseRef={editingSingleNote.verseRef}
                initialContent={editingSingleNote.content}
                initialTags={editingSingleNote.tags}
                onSave={onSaveEdit}
                onCancel={onCancelEditing}
              />
            </motion.div>
          ) : singleNotes.length > 0 ? (
            <motion.div
              key="verse-notes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(useSideBySide && (showVerseAsPill ? "shrink-0" : "flex-1 min-w-0"))}
            >
              <VerseNotes
                notes={singleNotes}
                isOpen={isVerseOpen}
                isPill={showVerseAsPill}
                onOpen={() => onOpenVerseNotes(verseNumber)}
                onClose={onClickAway}
                onEdit={(noteId) => onEditNote(noteId, verseNumber, false)}
                onDelete={onDelete}
                onAddNote={() => onAddNote(verseNumber)}
                onMouseEnter={() => onSingleBubbleMouseEnter(verseNumber)}
                onMouseLeave={onSingleBubbleMouseLeave}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {passageNoteJsx}

        <AnimatePresence initial={false}>
          {!editingSingleNote && !editingPassageNote && isCreatingHere && creatingFor && (
            <motion.div
              key={`create-${creatingFor.startVerse}-${creatingFor.endVerse}`}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <NoteEditor
                verseRef={creatingFor}
                variant={isPassageSelection ? "passage" : "default"}
                onSave={onSaveNew}
                onCancel={onClickAway}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
})
