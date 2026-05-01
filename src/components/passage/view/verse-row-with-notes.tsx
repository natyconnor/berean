import { memo, useCallback, useMemo, useState } from "react";
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
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PassageHeartControl } from "../verse-row";

const SavedPassagePill = memo(function SavedPassagePill({
  startVerse,
  endVerse,
  onHoverEnter,
  onHoverLeave,
  onToggleSavedPassage,
}: {
  startVerse: number;
  endVerse: number;
  onHoverEnter: (startVerse: number, endVerse: number) => void;
  onHoverLeave: () => void;
  onToggleSavedPassage: (startVerse: number, endVerse: number) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(
          "group relative inline-flex max-w-none shrink-0 flex-nowrap items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-red-300/60 bg-white/90 px-1.5 py-0.5 shadow-sm backdrop-blur-sm transition-colors",
          "hover:border-red-400/80",
          "dark:border-red-500/40 dark:bg-neutral-900/80 dark:hover:border-red-400/60",
        )}
        onMouseEnter={() => onHoverEnter(startVerse, endVerse)}
        onMouseLeave={onHoverLeave}
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        aria-label={`Hearted passage: verses ${startVerse}–${endVerse}. Click to remove.`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-red-400/35 via-rose-200/45 to-amber-50/30 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 dark:from-red-600/45 dark:via-red-950/55 dark:to-neutral-950/40"
        />
        <span className="relative z-10 flex shrink-0 flex-nowrap items-center gap-1">
          <Heart className="h-3 w-3 shrink-0 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400" />
          <span className="whitespace-nowrap text-[10px] font-medium leading-none tabular-nums text-muted-foreground">
            {startVerse}–{endVerse}
          </span>
        </span>
      </button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Remove this passage?</DialogTitle>
            <DialogDescription>
              This will remove verses {startVerse}–{endVerse} from your hearted
              list. You can heart the passage again anytime from the reader.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onToggleSavedPassage(startVerse, endVerse);
                setConfirmOpen(false);
              }}
            >
              Unheart passage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export interface CurrentChapter {
  book: string;
  chapter: number;
}

export interface VerseRowWithNotesProps {
  verseNumber: number;
  text: string;
  viewMode?: "compose" | "read";
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
  onEditorFocus: (key: string) => void;
  onStartCreatingPassageNote: (verseRef: VerseRef) => void;
  onNoteDeleteCleanup: (
    noteId: Id<"notes">,
    verseNumber: number,
    isPassage: boolean,
  ) => void;
  focusDistance?: number | null;
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
  passageHeart?: PassageHeartControl | null;
  isInHoveredSavedPassage?: boolean;
  savedPassagesAtAnchor?: Array<{
    startVerse: number;
    endVerse: number;
  }>;
  onSavedPassageHoverEnter?: (startVerse: number, endVerse: number) => void;
  onSavedPassageHoverLeave?: () => void;
  onToggleSavedPassage?: (startVerse: number, endVerse: number) => void;
}

export const VerseRowWithNotes = memo(function VerseRowWithNotes({
  verseNumber,
  text,
  viewMode = "compose",
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
  onEditorFocus,
  onStartCreatingPassageNote,
  onNoteDeleteCleanup,
  focusDistance = null,
  highlights,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  forceAddButtonVisible = false,
  addNoteTourId,
  rowTourId,
  passageHeart = null,
  isInHoveredSavedPassage = false,
  savedPassagesAtAnchor,
  onSavedPassageHoverEnter,
  onSavedPassageHoverLeave,
  onToggleSavedPassage,
}: VerseRowWithNotesProps) {
  const [isExitingSingleNote, setIsExitingSingleNote] = useState(false);
  const [isExitingPassageNote, setIsExitingPassageNote] = useState(false);

  const isReadMode = viewMode === "read";

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
    isVerseOpen ||
    isPassageOpen ||
    isCreatingHere ||
    isEditingSingleHere ||
    isEditingPassageHere;

  const handleCollapseVerse = useCallback(() => {
    if (isVerseOpen) onCloseVerseNotes(verseNumber);
    if (isPassageOpen) onClosePassageNotes(verseNumber);
    for (const draft of draftsForThisAnchor) {
      onCancelEditor(`new:${draft.startVerse}:${draft.endVerse}`);
    }
  }, [
    isVerseOpen,
    isPassageOpen,
    verseNumber,
    onCloseVerseNotes,
    onClosePassageNotes,
    draftsForThisAnchor,
    onCancelEditor,
  ]);

  const focusDimStyle = useMemo(() => {
    if (focusDistance === null) return undefined;
    if (focusDistance === 0) return { opacity: 1, filter: "none" } as const;
    if (focusDistance === 1)
      return { opacity: 0.55, filter: "blur(0.4px)" } as const;
    if (focusDistance === 2)
      return { opacity: 0.3, filter: "blur(0.8px)" } as const;
    return { opacity: 0.12, filter: "blur(1.2px)" } as const;
  }, [focusDistance]);

  const isFocusDimmed = focusDistance !== null && focusDistance > 0;

  const passageNoteJsx =
    passageNotes.length > 0 || isExitingPassageNote ? (
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
          editingNoteIds={editingNoteIds}
          onSaveEdit={onSaveEdit}
          onCancelEdit={(noteId) => onCancelEditor(`edit:${noteId}`)}
          onEditorDirtyChange={(noteId, isDirty) =>
            onEditorDirtyChange(`edit:${noteId}`, isDirty)
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
          onLastNoteDeletedAfterExit={(noteId) =>
            onNoteDeleteCleanup(noteId, verseNumber, true)
          }
          onExitingLastChange={setIsExitingPassageNote}
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
          isExpanded && "min-h-[240px]",
          "transition-[margin,opacity,filter] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isExpanded && "my-3",
          isFocusDimmed && "pointer-events-none",
        )}
        style={focusDimStyle}
      >
        {savedPassagesAtAnchor &&
          savedPassagesAtAnchor.length > 0 &&
          onSavedPassageHoverEnter &&
          onSavedPassageHoverLeave &&
          onToggleSavedPassage && (
            <div className="pointer-events-auto absolute top-1/2 right-full z-20 mr-2 flex -translate-y-1/2 flex-col items-end gap-1">
              {savedPassagesAtAnchor.map((span) => (
                <SavedPassagePill
                  key={`${span.startVerse}-${span.endVerse}`}
                  startVerse={span.startVerse}
                  endVerse={span.endVerse}
                  onHoverEnter={onSavedPassageHoverEnter}
                  onHoverLeave={onSavedPassageHoverLeave}
                  onToggleSavedPassage={onToggleSavedPassage}
                />
              ))}
            </div>
          )}
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
            density={isReadMode ? "reading" : "default"}
            onCollapseVerse={handleCollapseVerse}
            highlights={highlights}
            onCreateHighlight={onCreateHighlight}
            onDeleteHighlight={onDeleteHighlight}
            onRecolorHighlight={onRecolorHighlight}
            forceAddButtonVisible={forceAddButtonVisible}
            addNoteTourId={addNoteTourId}
            rowTourId={rowTourId}
            passageHeart={passageHeart}
            isInHoveredSavedPassage={isInHoveredSavedPassage}
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
          {singleNotes.length > 0 || isExitingSingleNote ? (
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
                editingNoteIds={editingNoteIds}
                onSaveEdit={onSaveEdit}
                onCancelEdit={(noteId) => onCancelEditor(`edit:${noteId}`)}
                onEditorDirtyChange={(noteId, isDirty) =>
                  onEditorDirtyChange(`edit:${noteId}`, isDirty)
                }
                onEditorFocus={(noteId) => onEditorFocus(`edit:${noteId}`)}
                onOpen={() => onOpenVerseNotes(verseNumber)}
                onClose={() => onCloseVerseNotes(verseNumber)}
                onEdit={(noteId) => {
                  const note = singleNotes.find((n) => n.noteId === noteId);
                  if (note)
                    onEditNote(noteId, note.verseRef, verseNumber, false);
                }}
                onDelete={onDelete}
                onAddNote={() => onAddNote(verseNumber)}
                onLastNoteDeletedAfterExit={(noteId) =>
                  onNoteDeleteCleanup(noteId, verseNumber, false)
                }
                onExitingLastChange={setIsExitingSingleNote}
                onMouseEnter={() => onSingleBubbleMouseEnter(verseNumber)}
                onMouseLeave={onSingleBubbleMouseLeave}
              />
            </motion.div>
          ) : null}

          {passageNoteJsx}

          <AnimatePresence initial={false}>
            {draftsForThisAnchor.map((draft) => {
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
                    onFocusWithin={() => onEditorFocus(draftEditorKey)}
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
