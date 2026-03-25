import { memo } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NoteEditor } from "@/components/notes/note-editor";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { NoteBody } from "@/lib/note-inline-content";
import {
  NoteCardActions,
  NoteTagList,
  StackedCardBackground,
  HoverEditButton,
  NoteContent,
} from "@/components/notes/view/note-card-primitives";
import { cn } from "@/lib/utils";
import { NoteBubbleShell, type BubbleState } from "./view/note-bubble-shell";
import { LAYOUT_CORRECTION_TRANSITION } from "./note-animation-config";

export type VerseNote = NoteWithRef;

interface CurrentChapter {
  book: string;
  chapter: number;
}

interface VerseNotesProps {
  notes: VerseNote[];
  isOpen: boolean;
  viewMode?: "compose" | "read";
  isPill?: boolean;
  currentChapter?: CurrentChapter;
  editingNoteIds?: Set<Id<"notes">>;
  onSaveEdit?: (noteId: Id<"notes">, body: NoteBody, tags: string[]) => void | Promise<void>;
  onCancelEdit?: (noteId: Id<"notes">) => void;
  onEditorDirtyChange?: (noteId: Id<"notes">, isDirty: boolean) => void;
  onOpen: () => void;
  onClose: () => void;
  onEdit: (noteId: Id<"notes">) => void;
  onDelete: (noteId: Id<"notes">) => void;
  onAddNote: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const VerseNotes = memo(function VerseNotes({
  notes,
  isOpen,
  viewMode = "compose",
  isPill = false,
  currentChapter,
  editingNoteIds,
  onSaveEdit,
  onCancelEdit,
  onEditorDirtyChange,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onAddNote,
  onMouseEnter,
  onMouseLeave,
}: VerseNotesProps) {
  if (notes.length === 0) return null;
  const isReadMode = viewMode === "read";
  const supportsInlineEditing = !!onSaveEdit && !!onCancelEdit;
  const hasEditsInGroup =
    supportsInlineEditing && editingNoteIds
      ? notes.some((note) => editingNoteIds.has(note.noteId))
      : false;
  const isEditingWithinGroup = hasEditsInGroup;
  const shouldShowExpanded = isOpen || isReadMode || isEditingWithinGroup;

  const bubbleState: BubbleState =
    isPill && !isEditingWithinGroup
      ? "pill"
      : shouldShowExpanded || isReadMode
        ? "expanded"
        : "collapsed";

  return (
    <NoteBubbleShell
      state={bubbleState}
      pill={<VerseNotesPill count={notes.length} onClick={onOpen} />}
      collapsed={
        notes.length === 1 ? (
          <CollapsedBubble
            note={notes[0]}
            currentChapter={currentChapter}
            onClick={onOpen}
            onEdit={() => onEdit(notes[0].noteId)}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          />
        ) : (
          <StackedBubble
            count={notes.length}
            preview={notes[0].content}
            onClick={onOpen}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          />
        )
      }
      expanded={
        <div
          data-note-surface
          className={isReadMode ? "space-y-3" : "min-h-[96px] space-y-1.5"}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {!isReadMode && (
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-1 text-xs font-medium transition-colors text-primary hover:text-primary/80"
                    onClick={onAddNote}
                  >
                    <Plus className="h-3 w-3" />
                    New note
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add new note for this verse</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={onClose}
                  >
                    <ChevronUp className="h-3 w-3" />
                    Collapse
                  </button>
                </TooltipTrigger>
                <TooltipContent>Collapse notes</TooltipContent>
              </Tooltip>
            </div>
          )}
          {notes.map((note, index) => (
            <motion.div
              key={note.noteId}
              layout
              transition={{
                layout: LAYOUT_CORRECTION_TRANSITION,
                delay: index * 0.03,
              }}
            >
              {supportsInlineEditing &&
              editingNoteIds?.has(note.noteId) ? (
                <div data-note-surface>
                  <NoteEditor
                    verseRef={note.verseRef}
                    initialContent={note.content}
                    initialBody={note.body}
                    initialTags={note.tags}
                    currentChapter={currentChapter}
                    onSave={(body, tags) => onSaveEdit(note.noteId, body, tags)}
                    onCancel={() => onCancelEdit(note.noteId)}
                    onDirtyChange={
                      onEditorDirtyChange
                        ? (isDirty) => onEditorDirtyChange(note.noteId, isDirty)
                        : undefined
                    }
                  />
                </div>
              ) : (
                <ExpandedBubble
                  note={note}
                  currentChapter={currentChapter}
                  density={isReadMode ? "reading" : "default"}
                  onEdit={() => onEdit(note.noteId)}
                  onDelete={() => onDelete(note.noteId)}
                />
              )}
            </motion.div>
          ))}
        </div>
      }
    />
  );
});

function CollapsedBubble({
  note,
  currentChapter,
  onClick,
  onEdit,
  onMouseEnter,
  onMouseLeave,
}: {
  note: VerseNote;
  currentChapter?: { book: string; chapter: number };
  onClick: () => void;
  onEdit: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      className="group relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        data-note-trigger
        className="w-full cursor-pointer py-1.5 pl-2.5 pr-10 text-left transition-colors rounded-lg text-[13px] bg-card cl-depth-1 cl-transition shadow-none"
        onClick={onClick}
      >
        <NoteContent
          content={note.content}
          body={note.body}
          truncateAt={100}
          currentChapter={currentChapter}
          className="text-muted-foreground line-clamp-2"
        />
        <NoteTagList tags={note.tags} className="mt-1" />
      </button>
      <HoverEditButton onEdit={onEdit} />
    </div>
  );
}

function StackedBubble({
  count,
  preview,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  count: number;
  preview: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <button
      type="button"
      data-note-trigger
      className="relative block w-full cursor-pointer text-left"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <StackedCardBackground count={count} variant="muted" isCandlelight />
      <div className="relative px-2.5 py-1.5 text-xs transition-colors rounded-lg bg-card cl-depth-1 cl-transition shadow-none">
        <div className="flex items-center justify-between mb-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {count} notes
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {preview}
        </p>
      </div>
    </button>
  );
}

export function VerseNotesPill({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-note-trigger
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-card hover:bg-muted/50 transition-colors cursor-pointer text-xs text-muted-foreground"
          onClick={onClick}
        >
          <Pencil className="h-3 w-3" />
          <span>{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {count} verse {count === 1 ? "note" : "notes"}
      </TooltipContent>
    </Tooltip>
  );
}

function ExpandedBubble({
  note,
  currentChapter,
  density = "default",
  onEdit,
  onDelete,
}: {
  note: VerseNote;
  currentChapter?: { book: string; chapter: number };
  density?: "default" | "reading";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isReading = density === "reading";

  return (
    <div
      className={cn(
        isReading ? "rounded-xl px-4 py-3" : "rounded-lg px-3 py-2.5 text-sm",
        "bg-card shadow-none cl-depth-3 cl-transition",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <NoteContent
          content={note.content}
          body={note.body}
          density={density}
          currentChapter={currentChapter}
          className={isReading ? "flex-1 text-foreground" : "flex-1"}
        />
        <NoteCardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <NoteTagList
        tags={note.tags}
        size={isReading ? "sm" : "xs"}
        className="mt-2"
      />
    </div>
  );
}
