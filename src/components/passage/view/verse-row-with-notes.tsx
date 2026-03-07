import { memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Id } from "../../../../convex/_generated/dataModel"
import { VerseRowLeft } from "../verse-row"
import { VerseNotes } from "../verse-notes"
import { PassageNotesBubble } from "../passage-notes-bubble"
import { NoteEditor } from "@/components/notes/note-editor"
import { cn } from "@/lib/utils"
import type { VerseRef } from "@/lib/verse-ref-utils"
import type { NoteWithRef } from "@/components/notes/model/note-model"

const layoutTransition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }

export interface VerseRowWithNotesProps {
  verseNumber: number
  text: string
  viewMode?: "compose" | "read"
  editorMode?: "inline" | "dialog"

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
  isFocusTarget?: boolean

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
  viewMode = "compose",
  editorMode = "inline",
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
  isFocusTarget = false,
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
  const isReadMode = viewMode === "read"
  const useDialogEditors = editorMode === "dialog"
  const shouldShowInlineEditors = !useDialogEditors

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

  const isEditingSingleHere =
    editingNoteId !== null && singleNotes.some((note) => note.noteId === editingNoteId)
  const isEditingPassageHere =
    editingNoteId !== null && passageNotes.some((note) => note.noteId === editingNoteId)

  const isAnyOpen =
    isVerseOpen ||
    isPassageOpen ||
    isCreatingHere ||
    isEditingSingleHere ||
    isEditingPassageHere

  const hasBothNoteTypes = singleNotes.length > 0 && passageNotes.length > 0
  const useSideBySide =
    !isReadMode &&
    hasBothNoteTypes &&
    !isCreatingHere
  const showVerseAsPill = useSideBySide && isPassageOpen
  const showPassageAsPill =
    useSideBySide && (isVerseOpen || isEditingSingleHere) && !isPassageOpen
  const showPassageCompact = useSideBySide && !isPassageOpen && !showPassageAsPill

  const passageNoteJsx = (
    passageNotes.length > 0 ? (
      <motion.div
        layout
        transition={{ layout: layoutTransition }}
        className={cn(
          useSideBySide &&
            (isPassageOpen
              ? "flex-1 min-w-[260px]"
              : showPassageAsPill
                ? "shrink-0"
                : "w-[180px] shrink-0")
        )}
      >
        <PassageNotesBubble
          notes={passageNotes}
          isOpen={isPassageOpen}
          isGlowing={isPassageRangeActive}
          viewMode={viewMode}
          isPill={showPassageAsPill}
          compact={showPassageCompact}
          editingNoteId={shouldShowInlineEditors ? editingNoteId : null}
          onSaveEdit={shouldShowInlineEditors ? onSaveEdit : undefined}
          onCancelEdit={shouldShowInlineEditors ? onCancelEditing : undefined}
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
    ) : null
  )

  return (
    <motion.div
      layout="position"
      transition={{ layout: layoutTransition }}
      className={
        isReadMode
          ? "grid grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6 items-start"
          : "grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start"
      }
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
          focus={{
            isTarget: isFocusTarget,
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
        {singleNotes.length > 0 ? (
          <motion.div
            layout
            transition={{ layout: layoutTransition }}
            className={cn(useSideBySide && (showVerseAsPill ? "shrink-0" : "flex-1 min-w-0"))}
          >
            <VerseNotes
              notes={singleNotes}
              isOpen={isVerseOpen}
              viewMode={viewMode}
              isPill={showVerseAsPill}
              editingNoteId={shouldShowInlineEditors ? editingNoteId : null}
              onSaveEdit={shouldShowInlineEditors ? onSaveEdit : undefined}
              onCancelEdit={shouldShowInlineEditors ? onCancelEditing : undefined}
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

        {passageNoteJsx}

        <AnimatePresence initial={false}>
          {shouldShowInlineEditors && isCreatingHere && creatingFor && (
            <motion.div
              key={`create-${creatingFor.startVerse}-${creatingFor.endVerse}`}
              layout
              data-note-surface
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
