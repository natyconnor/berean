import { memo } from "react";
import { motion } from "framer-motion";
import { Plus, ChevronUp, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { NoteBody } from "@/lib/note-inline-content";
import {
  HoverEditButton,
  NoteCardActions,
  NoteContent,
  NoteTagList,
} from "@/components/notes/view/note-card-primitives";
import { NoteEditor } from "@/components/notes/note-editor";
import { NoteBubbleShell, type BubbleState } from "./view/note-bubble-shell";
import { LAYOUT_CORRECTION_TRANSITION } from "./note-animation-config";

type PassageNote = NoteWithRef;

interface CurrentChapter {
  book: string;
  chapter: number;
}

interface PassageNotesBubbleProps {
  notes: PassageNote[];
  isOpen: boolean;
  isGlowing: boolean;
  viewMode?: "compose" | "read";
  isPill?: boolean;
  compact?: boolean;
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

export const PassageNotesBubble = memo(function PassageNotesBubble({
  notes,
  isOpen,
  isGlowing,
  viewMode = "compose",
  isPill = false,
  compact = false,
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
}: PassageNotesBubbleProps) {
  if (notes.length === 0) return null;
  const isReadMode = viewMode === "read";
  const supportsInlineEditing = !!onSaveEdit && !!onCancelEdit;
  const hasEditsInGroup =
    supportsInlineEditing && editingNoteIds
      ? notes.some((note) => editingNoteIds.has(note.noteId))
      : false;
  const isEditingWithinGroup = hasEditsInGroup;
  const shouldShowExpanded = isOpen || isReadMode || isEditingWithinGroup;

  const previewLength = compact ? 34 : 100;

  const bubbleState: BubbleState =
    isPill && !isEditingWithinGroup
      ? "pill"
      : shouldShowExpanded || isReadMode
        ? "expanded"
        : "collapsed";

  return (
    <NoteBubbleShell
      state={bubbleState}
      pill={
        <PassageNotesPill
          count={notes.length}
          verseRefLabel={formatVerseRef(notes[0].verseRef)}
          onClick={onOpen}
          isGlowing={isGlowing}
        />
      }
      collapsed={
        <CollapsedPassageBubble
          notes={notes}
          previewLength={previewLength}
          currentChapter={currentChapter}
          compact={compact}
          isGlowing={isGlowing}
          onOpen={onOpen}
          onEdit={onEdit}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      }
      expanded={
        <div
          data-note-surface
          className={
            isReadMode
              ? "space-y-3 rounded-xl bg-amber-50/25 dark:bg-amber-900/14 p-3"
              : "min-h-[96px] space-y-1.5 rounded-lg bg-amber-50/30 dark:bg-amber-900/12 p-2.5"
          }
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400/70 shrink-0" />
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400/70 uppercase tracking-wide">
                {formatVerseRef(notes[0].verseRef)}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
                <TooltipContent>Add new note for this passage</TooltipContent>
              </Tooltip>
              {!isReadMode && (
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
              )}
            </div>
          </div>
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
                    variant="passage"
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
                <ExpandedPassageNote
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

function CollapsedPassageBubble({
  notes,
  previewLength,
  currentChapter,
  compact,
  isGlowing,
  onOpen,
  onEdit,
  onMouseEnter,
  onMouseLeave,
}: {
  notes: PassageNote[];
  previewLength: number;
  currentChapter?: CurrentChapter;
  compact: boolean;
  isGlowing: boolean;
  onOpen: () => void;
  onEdit: (noteId: Id<"notes">) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative text-sm transition-colors rounded-lg",
        "bg-amber-50/90 dark:bg-amber-900/22",
        "cl-depth-1 cl-transition shadow-none",
        "hover:bg-amber-50 dark:hover:bg-amber-800/25",
        isGlowing && "cl-glow-pulse",
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        data-note-trigger
        className="w-full rounded-[inherit] text-left"
        onClick={onOpen}
      >
        <div
          className={cn(
            "px-3 py-2",
            compact && "px-2 py-1.5",
            notes.length === 1 && !compact && "pr-10",
          )}
        >
          <div className="mb-1 flex min-w-0 items-center gap-1.5">
            <BookOpen
              className={cn(
                "text-amber-600 dark:text-amber-400/70 shrink-0",
                compact ? "h-2.5 w-2.5" : "h-3 w-3",
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 font-semibold text-amber-700 dark:text-amber-400/70 uppercase tracking-wide truncate",
                compact ? "text-[8px]" : "text-[10px]",
              )}
            >
              {formatVerseRef(notes[0].verseRef)}
            </span>
            {notes.length > 1 && (
              <Badge
                variant="outline"
                className={cn(
                  "border-amber-300 text-amber-700 dark:border-amber-600/50 dark:text-amber-400/70 ml-auto shrink-0",
                  compact
                    ? "text-[8px] px-1 py-0"
                    : "text-[10px] px-1.5 py-0",
                )}
              >
                {notes.length}
              </Badge>
            )}
          </div>
          <NoteContent
            content={notes[0].content}
            body={notes[0].body}
            truncateAt={previewLength}
            currentChapter={currentChapter}
            className={cn(
              "text-muted-foreground",
              compact ? "line-clamp-1 text-[10px]" : "line-clamp-2",
            )}
          />
          {!compact && notes[0].tags.length > 0 && (
            <NoteTagList
              tags={notes[0].tags}
              variant="passage"
              size="xs"
              className="mt-1.5"
            />
          )}
        </div>
      </button>
      {notes.length === 1 && !compact && (
        <HoverEditButton
          variant="passage"
          onEdit={() => onEdit(notes[0].noteId)}
        />
      )}
    </div>
  );
}

function PassageNotesPill({
  count,
  verseRefLabel,
  onClick,
  isGlowing,
}: {
  count: number;
  verseRefLabel: string;
  onClick: () => void;
  isGlowing: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-note-trigger
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-600/45 dark:bg-amber-900/20 dark:text-amber-300",
            isGlowing && "ring-1 ring-amber-400/50",
          )}
          onClick={onClick}
        >
          <BookOpen className="h-3 w-3" />
          <span>{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {count} passage {count === 1 ? "note" : "notes"} for {verseRefLabel}
      </TooltipContent>
    </Tooltip>
  );
}

function ExpandedPassageNote({
  note,
  currentChapter,
  density = "default",
  onEdit,
  onDelete,
}: {
  note: PassageNote;
  currentChapter?: { book: string; chapter: number };
  density?: "default" | "reading";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isReading = density === "reading";
  return (
    <div
      className={cn(
        isReading
          ? "rounded-lg bg-amber-50/90 dark:bg-amber-900/22 px-4 py-3"
          : "rounded-md bg-amber-50/90 dark:bg-amber-900/22 px-3 py-2 text-sm",
        "cl-depth-3-amber cl-transition shadow-none",
        isReading && "group",
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
        <NoteCardActions
          onEdit={onEdit}
          onDelete={onDelete}
          variant="passage"
          reveal={isReading ? "hover" : "always"}
        />
      </div>
      <NoteTagList
        tags={note.tags}
        variant="passage"
        size={isReading ? "sm" : "xs"}
        className="mt-2"
      />
    </div>
  );
}
