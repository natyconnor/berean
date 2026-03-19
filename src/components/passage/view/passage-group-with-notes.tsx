import { memo, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { VerseTextPane } from "./verse-text-pane";
import { PassageNotesBubble } from "../passage-notes-bubble";
import { VerseNotes } from "../verse-notes";
import { NoteEditor } from "@/components/notes/note-editor";
import type { VerseInteractionHandlers } from "../verse-row";
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
  editorMode: "inline" | "dialog";
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
  openVerseKeys: Set<number>;
  editingNoteIds: Set<Id<"notes">>;
  draftsForAnchor: VerseRef[];
  onOpenPassageNotes: (verseNumber: number) => void;
  onClosePassageNotes: (verseNumber: number) => void;
  onOpenVerseNotes: (verseNumber: number) => void;
  onCloseVerseNotes: (verseNumber: number) => void;
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
  onPassageBubbleMouseEnter: (verseNumber: number) => void;
  onPassageBubbleMouseLeave: () => void;
  onCollapse: () => void;
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
  editorMode,
  currentChapter,
  highlightsByVerse,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  isPassageOpen,
  openVerseKeys,
  editingNoteIds,
  draftsForAnchor,
  onOpenPassageNotes,
  onClosePassageNotes,
  onOpenVerseNotes,
  onCloseVerseNotes,
  onEditNote,
  onDelete,
  onSaveEdit,
  onSaveNew,
  onCancelEditor,
  onEditorDirtyChange,
  onStartCreatingPassageNote,
  onPassageBubbleMouseEnter,
  onPassageBubbleMouseLeave,
  onCollapse,
}: PassageGroupWithNotesProps) {
  const anchorVerse = verses[0]?.verseNumber ?? 0;
  const shouldShowInlineEditors = editorMode === "inline";

  const handleCollapseGroup = useCallback(
    (_verseNumber: number) => onCollapse(),
    [onCollapse],
  );

  return (
    <LayoutGroup id={`passage-group-${anchorVerse}`}>
      <div
        className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start"
        data-note-surface
      >
        {/* LEFT — stacked expanded verse rows in a shared passage shell */}
        <motion.div
          layout="position"
          transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
          className="flex flex-col"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CROSSFADE_TRANSITION}
            className={cn(
              "rounded-lg",
              "border border-amber-200/70 dark:border-amber-700/40",
              "bg-amber-50/40 dark:bg-amber-950/20",
              "ring-1 ring-amber-300/30 dark:ring-amber-600/20",
              "shadow-sm shadow-amber-100/60 dark:shadow-amber-950/30",
            )}
          >
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
                handlers={NOOP_HANDLERS}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* RIGHT — shared notes column */}
        <motion.div
          layout="position"
          transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
          className="py-1 select-none space-y-1.5"
          data-note-surface
        >
          {passageNotes.length > 0 && (
            <PassageNotesBubble
              notes={passageNotes}
              isOpen={isPassageOpen}
              isGlowing={false}
              viewMode={viewMode}
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
              onOpen={() => onOpenPassageNotes(anchorVerse)}
              onClose={() => onClosePassageNotes(anchorVerse)}
              onEdit={(noteId: Id<"notes">) => {
                const note = passageNotes.find((n) => n.noteId === noteId);
                if (note) onEditNote(noteId, note.verseRef, anchorVerse, true);
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
              onMouseEnter={() => onPassageBubbleMouseEnter(anchorVerse)}
              onMouseLeave={onPassageBubbleMouseLeave}
            />
          )}

          {Array.from(singleNotesByVerse.entries()).map(([verseNum, notes]) => (
            <div key={verseNum}>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                v{verseNum}
              </span>
              <VerseNotes
                notes={notes}
                isOpen={openVerseKeys.has(verseNum)}
                viewMode={viewMode}
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
                onOpen={() => onOpenVerseNotes(verseNum)}
                onClose={() => onCloseVerseNotes(verseNum)}
                onEdit={(noteId) => {
                  const note = notes.find((n) => n.noteId === noteId);
                  if (note) onEditNote(noteId, note.verseRef, verseNum, false);
                }}
                onDelete={onDelete}
                onAddNote={() => {}}
              />
            </div>
          ))}

          <AnimatePresence initial={false}>
            {shouldShowInlineEditors &&
              draftsForAnchor.map((draft) => {
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
