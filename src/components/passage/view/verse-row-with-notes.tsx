import { memo, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { VerseTextPane } from "./verse-text-pane";
import { VerseNotes } from "../verse-notes";
import { PassageNotesBubble } from "../passage-notes-bubble";
import { NoteEditor } from "@/components/notes/note-editor";
import { cn } from "@/lib/utils";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { HighlightRange } from "@/lib/highlight-utils";
import {
  LAYOUT_CORRECTION_TRANSITION,
  NOTE_ENTER_TRANSITION,
} from "../note-animation-config";

export interface CurrentChapter {
  book: string;
  chapter: number;
}

export interface VerseRowWithNotesProps {
  verseNumber: number;
  text: string;
  viewMode?: "compose" | "read";
  editorMode?: "inline" | "dialog";
  currentChapter?: CurrentChapter;

  selectedVerses: Set<number>;
  isInSelectionRange: boolean;
  isPassageSelection: boolean;

  singleNotes: NoteWithRef[];
  passageNotes: NoteWithRef[];
  passageAnchor: number | undefined;

  isPassageRangeActive: boolean;
  isNoteBubbleHovered: boolean;

  openVerseKeys: Set<number>;
  openPassageKeys: Set<number>;
  draftsForThisAnchor: VerseRef[];
  editingNoteIds: Set<Id<"notes">>;
  isFocusTarget?: boolean;

  onAddNote: (verseNumber: number) => void;
  onMouseDown: (verseNumber: number) => void;
  onMouseEnter: (verseNumber: number) => void;
  onMouseLeave: () => void;
  onSingleBubbleMouseEnter: (verseNumber: number) => void;
  onSingleBubbleMouseLeave: () => void;
  onPassageBubbleMouseEnter: (verseNumber: number) => void;
  onPassageBubbleMouseLeave: () => void;
  onOpenVerseNotes: (verseNumber: number) => void;
  onCloseVerseNotes: (verseNumber: number) => void;
  onOpenPassageNotes: (verseNumber: number) => void;
  onClosePassageNotes: (verseNumber: number) => void;
  onEditNote: (
    noteId: Id<"notes">,
    verseRef: VerseRef,
    verseNumber: number,
    isPassage: boolean,
  ) => void;
  onDelete: (noteId: Id<"notes">) => Promise<void>;
  onSaveEdit: (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onSaveNew: (
    verseRef: VerseRef,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onCancelEditor: (key: string) => void;
  onEditorDirtyChange: (key: string, isDirty: boolean) => void;
  onStartCreatingPassageNote: (verseRef: VerseRef) => void;
  highlights?: HighlightRange[];
  onCreateHighlight?: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onRecolorHighlight?: (highlightId: string, color: string) => void;
  forceAddButtonVisible?: boolean;
  addNoteTourId?: string;
  rowTourId?: string;
}

export const VerseRowWithNotes = memo(function VerseRowWithNotes({
  verseNumber,
  text,
  viewMode = "compose",
  editorMode = "inline",
  currentChapter,
  selectedVerses,
  isInSelectionRange,
  isPassageSelection,
  singleNotes,
  passageNotes,
  passageAnchor,
  isPassageRangeActive,
  isNoteBubbleHovered,
  openVerseKeys,
  openPassageKeys,
  draftsForThisAnchor,
  editingNoteIds,
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
  onCloseVerseNotes,
  onOpenPassageNotes,
  onClosePassageNotes,
  onEditNote,
  onDelete,
  onSaveEdit,
  onSaveNew,
  onCancelEditor,
  onEditorDirtyChange,
  onStartCreatingPassageNote,
  highlights,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  forceAddButtonVisible = false,
  addNoteTourId,
  rowTourId,
}: VerseRowWithNotesProps) {
  const isReadMode = viewMode === "read";
  const useDialogEditors = editorMode === "dialog";
  const shouldShowInlineEditors = !useDialogEditors;

  const isPassageAnchor = passageNotes.length > 0;
  const isInPassageRange = passageAnchor !== undefined && !isPassageAnchor;

  const isVerseOpen = openVerseKeys.has(verseNumber);
  const isPassageOpen = openPassageKeys.has(verseNumber);
  const isCreatingHere = draftsForThisAnchor.length > 0;

  const isEditingSingleHere =
    editingNoteIds.size > 0 &&
    singleNotes.some((note) => editingNoteIds.has(note.noteId));
  const isEditingPassageHere =
    editingNoteIds.size > 0 &&
    passageNotes.some((note) => editingNoteIds.has(note.noteId));

  const isAnyOpen =
    isVerseOpen ||
    isPassageOpen ||
    isCreatingHere ||
    isEditingSingleHere ||
    isEditingPassageHere;

  const hasBothNoteTypes = singleNotes.length > 0 && passageNotes.length > 0;
  const useSideBySide = hasBothNoteTypes && !isCreatingHere;
  const showVerseAsPill =
    useSideBySide &&
    isPassageOpen &&
    (isVerseOpen || isReadMode || isEditingSingleHere);
  const showPassageAsPill =
    useSideBySide &&
    !isPassageOpen &&
    (isVerseOpen || isEditingSingleHere || isReadMode);
  const showPassageCompact =
    useSideBySide && !isPassageOpen && !showPassageAsPill;

  const isExpanded =
    !isReadMode &&
    (isVerseOpen || isPassageOpen || isCreatingHere || isEditingSingleHere || isEditingPassageHere);

  const handleCollapseVerse = useCallback(() => {
    if (isVerseOpen) onCloseVerseNotes(verseNumber);
    if (isPassageOpen) onClosePassageNotes(verseNumber);
    for (const draft of draftsForThisAnchor) {
      onCancelEditor(`new:${draft.startVerse}:${draft.endVerse}`);
    }
  }, [isVerseOpen, isPassageOpen, verseNumber, onCloseVerseNotes, onClosePassageNotes, draftsForThisAnchor, onCancelEditor]);

  const passageNoteJsx =
    passageNotes.length > 0 ? (
      <motion.div
        layout="position"
        transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
        className={cn(
          useSideBySide &&
            (isPassageOpen
              ? "flex-1 min-w-[260px]"
              : showPassageAsPill
                ? "shrink-0"
                : "w-[180px] shrink-0"),
        )}
      >
        <PassageNotesBubble
          notes={passageNotes}
          isOpen={isPassageOpen}
          isGlowing={isPassageRangeActive}
          viewMode={viewMode}
          isPill={showPassageAsPill}
          compact={showPassageCompact}
          currentChapter={currentChapter}
          editingNoteIds={shouldShowInlineEditors ? editingNoteIds : undefined}
          onSaveEdit={shouldShowInlineEditors ? onSaveEdit : undefined}
          onCancelEdit={
            shouldShowInlineEditors
              ? (noteId) => onCancelEditor(`edit:${noteId}`)
              : undefined
          }
          onEditorDirtyChange={
            shouldShowInlineEditors
              ? (noteId, isDirty) =>
                  onEditorDirtyChange(`edit:${noteId}`, isDirty)
              : undefined
          }
          onOpen={() => onOpenPassageNotes(verseNumber)}
          onClose={() => onClosePassageNotes(verseNumber)}
          onEdit={(noteId: Id<"notes">) => {
            const note = passageNotes.find((n) => n.noteId === noteId);
            if (note) onEditNote(noteId, note.verseRef, verseNumber, true);
          }}
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
    ) : null;

  return (
    // LayoutGroup scopes all layout animations to this single verse row so
    // that a layout change in row N never triggers layout corrections in row M.
    <LayoutGroup id={`verse-row-${verseNumber}`}>
    <div
      className={cn(
        "relative overflow-visible hover:z-10 focus-within:z-10",
        isReadMode
          ? "grid grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6 items-start"
          : "grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start",
      )}
    >
      <motion.div
        layout="position"
        transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
        className="flex h-full flex-col"
      >
        <VerseTextPane
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
          isExpanded={isExpanded}
          onCollapseVerse={handleCollapseVerse}
          highlights={highlights}
          onCreateHighlight={onCreateHighlight}
          onDeleteHighlight={onDeleteHighlight}
          onRecolorHighlight={onRecolorHighlight}
          forceAddButtonVisible={forceAddButtonVisible}
          addNoteTourId={addNoteTourId}
          rowTourId={rowTourId}
          handlers={{
            onAddNote,
            onMouseDown,
            onMouseEnter,
            onMouseLeave,
          }}
        />
      </motion.div>

      <motion.div
        layout="position"
        transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
        className={cn(
          "py-1 select-none",
          useSideBySide ? "flex gap-2 items-start" : "space-y-1.5",
        )}
        {...(isAnyOpen ? { "data-notes-open": "" } : {})}
      >
        {singleNotes.length > 0 ? (
          <motion.div
            layout="position"
            transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
            className={cn(
              useSideBySide &&
                (showVerseAsPill ? "shrink-0" : "flex-1 min-w-0"),
            )}
          >
            <VerseNotes
              notes={singleNotes}
              isOpen={isVerseOpen}
              viewMode={viewMode}
              isPill={showVerseAsPill}
              currentChapter={currentChapter}
              editingNoteIds={
                shouldShowInlineEditors ? editingNoteIds : undefined
              }
              onSaveEdit={shouldShowInlineEditors ? onSaveEdit : undefined}
              onCancelEdit={
                shouldShowInlineEditors
                  ? (noteId) => onCancelEditor(`edit:${noteId}`)
                  : undefined
              }
              onEditorDirtyChange={
                shouldShowInlineEditors
                  ? (noteId, isDirty) =>
                      onEditorDirtyChange(`edit:${noteId}`, isDirty)
                  : undefined
              }
              onOpen={() => onOpenVerseNotes(verseNumber)}
              onClose={() => onCloseVerseNotes(verseNumber)}
              onEdit={(noteId) => {
                const note = singleNotes.find((n) => n.noteId === noteId);
                if (note) onEditNote(noteId, note.verseRef, verseNumber, false);
              }}
              onDelete={onDelete}
              onAddNote={() => onAddNote(verseNumber)}
              onMouseEnter={() => onSingleBubbleMouseEnter(verseNumber)}
              onMouseLeave={onSingleBubbleMouseLeave}
            />
          </motion.div>
        ) : null}

        {passageNoteJsx}

        <AnimatePresence initial={false}>
          {shouldShowInlineEditors &&
            draftsForThisAnchor.map((draft) => {
              const draftEditorKey = `new:${draft.startVerse}:${draft.endVerse}`;
              return (
                <motion.div
                  key={draftEditorKey}
                  layout
                  data-note-surface
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={NOTE_ENTER_TRANSITION}
                >
                  <NoteEditor
                    verseRef={draft}
                    variant={
                      draft.startVerse !== draft.endVerse
                        ? "passage"
                        : "default"
                    }
                    onSave={(body, tags) => onSaveNew(draft, body, tags)}
                    onCancel={() => onCancelEditor(draftEditorKey)}
                    onDirtyChange={(isDirty) =>
                      onEditorDirtyChange(draftEditorKey, isDirty)
                    }
                  />
                </motion.div>
              );
            })}
        </AnimatePresence>
      </motion.div>
    </div>
    </LayoutGroup>
  );
});
