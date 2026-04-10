import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { VerseTextPane } from "./verse-text-pane";
import { PassageNotesBubble } from "../passage-notes-bubble";
import { VerseNotesPill } from "../verse-notes";
import { NoteEditor } from "@/components/notes/note-editor";
import type {
  VerseInteractionHandlers,
  PassageHeartControl,
} from "../verse-row";
import {
  LAYOUT_CORRECTION_TRANSITION,
  CROSSFADE_TRANSITION,
  NOTE_ENTER_TRANSITION,
} from "../note-animation-config";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { HighlightRange } from "@/lib/highlight-utils";
import type { CurrentChapter } from "./verse-row-with-notes";

interface PassageGroupWithNotesProps {
  verses: Array<{ verseNumber: number; text: string }>;
  passageNotes: NoteWithRef[];
  singleNotesByVerse: Map<number, NoteWithRef[]>;
  viewMode: "compose" | "read";
  currentChapter: CurrentChapter;
  highlightsByVerse: Map<number, HighlightRange[]>;
  onCreateHighlight?: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onRecolorHighlight?: (highlightId: string, color: string) => void;
  isPassageOpen: boolean;
  editingNoteIds: Set<Id<"notes">>;
  draftsForAnchor: VerseRef[];
  focusDistance?: number | null;
  onOpenPassageNotes: (verseNumber: number) => void;
  onClosePassageNotes: (verseNumber: number) => void;
  onOpenVerseNotes: (verseNumber: number) => void;
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
  onPassageBubbleMouseEnter: (verseNumber: number) => void;
  onPassageBubbleMouseLeave: () => void;
  onCollapse: () => void;
  groupPassageHeart: PassageHeartControl | null;
}

const NOOP_HANDLERS: VerseInteractionHandlers = {
  onAddNote: () => {},
  onMouseDown: () => {},
  onMouseEnter: () => {},
  onMouseLeave: () => {},
};

const EMPTY_NOTE_INDICATOR = {
  hasOwnNote: false,
  isPassageAnchor: false,
  isInPassageRange: false,
} as const;

const EMPTY_SELECTION = {
  isSelected: false,
  isInSelectionRange: false,
  isPassageSelection: false,
} as const;

const EMPTY_HOVER = {
  isPassageRangeActive: false,
  isNoteBubbleHovered: false,
} as const;

export const PassageGroupWithNotes = memo(function PassageGroupWithNotes({
  verses,
  passageNotes,
  singleNotesByVerse,
  viewMode,
  currentChapter,
  highlightsByVerse,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  isPassageOpen,
  editingNoteIds,
  draftsForAnchor,
  focusDistance = null,
  onOpenPassageNotes,
  onClosePassageNotes,
  onOpenVerseNotes,
  onEditNote,
  onDelete,
  onSaveEdit,
  onSaveNew,
  onCancelEditor,
  onEditorDirtyChange,
  onEditorFocus,
  onStartCreatingPassageNote,
  onNoteDeleteCleanup,
  onPassageBubbleMouseEnter,
  onPassageBubbleMouseLeave,
  onCollapse,
  groupPassageHeart,
}: PassageGroupWithNotesProps) {
  const [isExitingPassageNote, setIsExitingPassageNote] = useState(false);
  const anchorVerse = verses[0]?.verseNumber ?? 0;

  const handleCollapseGroup = useCallback(() => onCollapse(), [onCollapse]);

  const handleVerseNotePillClick = useCallback(
    (verseNumber: number) => {
      onClosePassageNotes(anchorVerse);
      onOpenVerseNotes(verseNumber);
    },
    [anchorVerse, onClosePassageNotes, onOpenVerseNotes],
  );

  const versesWithSingleNotes = useMemo(
    () =>
      verses.filter((v) => {
        const notes = singleNotesByVerse.get(v.verseNumber);
        return notes !== undefined && notes.length > 0;
      }),
    [verses, singleNotesByVerse],
  );

  const isReadMode = viewMode === "read";

  const focusDimStyle: CSSProperties | undefined = useMemo(() => {
    if (focusDistance === null) return undefined;
    if (focusDistance === 0) return { opacity: 1, filter: "none" };
    if (focusDistance === 1) return { opacity: 0.55, filter: "blur(0.4px)" };
    if (focusDistance === 2) return { opacity: 0.3, filter: "blur(0.8px)" };
    return { opacity: 0.12, filter: "blur(1.2px)" };
  }, [focusDistance]);

  const isFocusDimmed = focusDistance !== null && focusDistance > 0;

  return (
    <LayoutGroup id={`passage-group-${anchorVerse}`}>
      <div
        className={cn(
          "grid items-start",
          isReadMode
            ? "grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6"
            : "grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5",
          "transition-[margin,opacity,filter] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] my-3",
          isFocusDimmed && "pointer-events-none",
        )}
        style={focusDimStyle}
        data-note-surface
      >
        {/* LEFT — stacked expanded verse rows in a shared passage shell */}
        <motion.div
          layout="position"
          transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
          className="flex h-full min-h-0 flex-col self-stretch"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CROSSFADE_TRANSITION}
            className="flex h-full min-h-0 flex-col justify-center rounded-lg bg-amber-100/60 dark:bg-amber-900/20 cl-depth-2 cl-transition"
          >
            <div className="flex flex-col">
              {verses.map((verse, index) => (
                <VerseTextPane
                  key={verse.verseNumber}
                  verseNumber={verse.verseNumber}
                  text={verse.text}
                  selection={EMPTY_SELECTION}
                  noteIndicator={EMPTY_NOTE_INDICATOR}
                  hover={EMPTY_HOVER}
                  isExpanded={true}
                  variant="groupedPassage"
                  showCollapseControl={index === 0}
                  onCollapseVerse={handleCollapseGroup}
                  highlights={highlightsByVerse.get(verse.verseNumber)}
                  onCreateHighlight={onCreateHighlight}
                  onDeleteHighlight={onDeleteHighlight}
                  onRecolorHighlight={onRecolorHighlight}
                  passageHeart={index === 0 ? groupPassageHeart : null}
                  handlers={NOOP_HANDLERS}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* RIGHT — shared notes column */}
        <motion.div
          layout="position"
          transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
          className="py-1 select-none"
          data-note-surface
        >
          <div className="flex items-start gap-3">
            {versesWithSingleNotes.length > 0 && (
              <div className="shrink-0 flex flex-col items-start gap-1.5 pt-0.5">
                {versesWithSingleNotes.map((verse) => {
                  const notes = singleNotesByVerse.get(verse.verseNumber)!;
                  return (
                    <div
                      key={verse.verseNumber}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <span className="text-[9px] font-semibold text-muted-foreground tabular-nums leading-none">
                        v{verse.verseNumber}
                      </span>
                      <VerseNotesPill
                        count={notes.length}
                        onClick={() =>
                          handleVerseNotePillClick(verse.verseNumber)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              {(passageNotes.length > 0 || isExitingPassageNote) && (
                <PassageNotesBubble
                  notes={passageNotes}
                  isOpen={isPassageOpen}
                  isGlowing={false}
                  viewMode={viewMode}
                  currentChapter={currentChapter}
                  editingNoteIds={editingNoteIds}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={(noteId) => onCancelEditor(`edit:${noteId}`)}
                  onEditorDirtyChange={(noteId, isDirty) =>
                    onEditorDirtyChange(`edit:${noteId}`, isDirty)
                  }
                  onEditorFocus={(noteId) => onEditorFocus(`edit:${noteId}`)}
                  onOpen={() => onOpenPassageNotes(anchorVerse)}
                  onClose={() => onClosePassageNotes(anchorVerse)}
                  onEdit={(noteId: Id<"notes">) => {
                    const note = passageNotes.find((n) => n.noteId === noteId);
                    if (note)
                      onEditNote(noteId, note.verseRef, anchorVerse, true);
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
                    onNoteDeleteCleanup(noteId, anchorVerse, true)
                  }
                  onExitingLastChange={setIsExitingPassageNote}
                  onMouseEnter={() => onPassageBubbleMouseEnter(anchorVerse)}
                  onMouseLeave={onPassageBubbleMouseLeave}
                />
              )}

              <AnimatePresence initial={false}>
                {draftsForAnchor.map((draft) => {
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
            </div>
          </div>
        </motion.div>
      </div>
    </LayoutGroup>
  );
});
