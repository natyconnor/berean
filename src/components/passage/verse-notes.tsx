import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, ChevronUp, BookOpen } from "lucide-react";
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
import {
  NoteCardActions,
  NoteTagList,
  StackedCardBackground,
  HoverEditButton,
  NoteContent,
} from "@/components/notes/view/note-card-primitives";

const fadeInOut = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15 },
};

export type VerseNote = NoteWithRef;

interface VerseNotesProps {
  notes: VerseNote[];
  isOpen: boolean;
  isPill?: boolean;
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
  isPill = false,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onAddNote,
  onMouseEnter,
  onMouseLeave,
}: VerseNotesProps) {
  if (notes.length === 0) return null;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {isPill ? (
        <motion.div key="pill" {...fadeInOut}>
          <VerseNotesPill count={notes.length} onClick={onOpen} />
        </motion.div>
      ) : !isOpen ? (
        notes.length === 1 ? (
          <motion.div key="collapsed-single" {...fadeInOut}>
            <CollapsedBubble
              note={notes[0]}
              onClick={onOpen}
              onEdit={() => onEdit(notes[0].noteId)}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />
          </motion.div>
        ) : (
          <motion.div key="collapsed-stacked" {...fadeInOut}>
            <StackedBubble
              count={notes.length}
              preview={notes[0].content}
              onClick={onOpen}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />
          </motion.div>
        )
      ) : (
        <motion.div
          key="expanded"
          {...fadeInOut}
          data-note-surface
          className="space-y-2"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
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
          {notes.map((note, index) => (
            <motion.div
              key={note.noteId}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: index * 0.03 }}
            >
              <ExpandedBubble
                note={note}
                onEdit={() => onEdit(note.noteId)}
                onDelete={() => onDelete(note.noteId)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function CollapsedBubble({
  note,
  onClick,
  onEdit,
  onMouseEnter,
  onMouseLeave,
}: {
  note: VerseNote;
  onClick: () => void;
  onEdit: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      data-note-trigger
      className="group relative border rounded-lg px-3 py-2 cursor-pointer transition-all hover:shadow-sm text-sm bg-card border-border"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NoteContent
        content={note.content}
        truncateAt={100}
        className="text-muted-foreground line-clamp-2"
      />
      <NoteTagList tags={note.tags} className="mt-1.5" />
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
    <div
      data-note-trigger
      className="relative cursor-pointer"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <StackedCardBackground count={count} variant="muted" />
      <div className="relative border rounded-lg px-3 py-2 transition-all hover:shadow-sm text-sm bg-card border-border">
        <div className="flex items-center justify-between mb-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {count} notes
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-1 text-xs">{preview}</p>
      </div>
    </div>
  );
}

function VerseNotesPill({
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
  onEdit,
  onDelete,
}: {
  note: VerseNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg px-3 py-2 shadow-sm text-sm bg-card border-border">
      <div className="flex items-start justify-between gap-2">
        <NoteContent content={note.content} className="flex-1" />
        <NoteCardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <NoteTagList tags={note.tags} className="mt-1.5" />
    </div>
  );
}

// ─── Passage Notes Bubble ────────────────────────────────────────────────────

interface PassageNotesBubbleProps {
  notes: VerseNote[];
  isOpen: boolean;
  isGlowing: boolean;
  compact?: boolean;
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
  compact = false,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onAddNote,
  onMouseEnter,
  onMouseLeave,
}: PassageNotesBubbleProps) {
  if (notes.length === 0) return null;

  const layoutTransition = {
    duration: 0.24,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  const previewLength = compact ? 40 : 100;
  const preview =
    notes[0].content.length > previewLength
      ? notes[0].content.slice(0, previewLength) + "..."
      : notes[0].content;

  return (
    <motion.div layout transition={{ layout: layoutTransition }}>
      {!isOpen ? (
        <div
          data-note-trigger
          className={cn(
            "group relative cursor-pointer rounded-lg border-l-2 border text-sm transition-colors",
            "border-l-amber-400 border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/50 dark:border-l-amber-600/70",
            "hover:shadow-sm hover:bg-amber-50 dark:hover:bg-amber-800/25",
            isGlowing &&
              "animate-pulse-subtle ring-1 ring-amber-400/50 shadow-sm shadow-amber-200/60 dark:shadow-amber-950/60"
          )}
          onClick={onOpen}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <div className={cn("px-3 py-2", compact && "px-2 py-1.5")}>
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen
                className={cn(
                  "text-amber-600 dark:text-amber-400/70 shrink-0",
                  compact ? "h-2.5 w-2.5" : "h-3 w-3"
                )}
              />
              <span
                className={cn(
                  "font-semibold text-amber-700 dark:text-amber-400/70 uppercase tracking-wide truncate",
                  compact ? "text-[8px]" : "text-[10px]"
                )}
              >
                {formatVerseRef(notes[0].verseRef)}
              </span>
              {notes.length > 1 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border-amber-300 text-amber-700 dark:border-amber-600/50 dark:text-amber-400/70 ml-auto shrink-0",
                    compact ? "text-[8px] px-1 py-0" : "text-[10px] px-1.5 py-0"
                  )}
                >
                  {notes.length}
                </Badge>
              )}
            </div>
            <p
              className={cn(
                "text-muted-foreground leading-relaxed",
                compact ? "line-clamp-1 text-[11px]" : "line-clamp-2"
              )}
            >
              {preview}
            </p>
            {!compact && notes[0].tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {notes[0].tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-amber-300 dark:border-amber-600/45"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {notes.length === 1 && !compact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(notes[0].noteId);
                  }}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit note</TooltipContent>
            </Tooltip>
          )}
        </div>
      ) : (
        <div
          data-note-surface
          className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-900/15 dark:border-amber-700/50 p-2"
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
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={onAddNote}
                  >
                    <Plus className="h-3 w-3" />
                    New note
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add new note for this passage</TooltipContent>
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
          </div>
          {notes.map((note, index) => (
            <motion.div
              key={note.noteId}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: index * 0.03 }}
            >
              <ExpandedPassageNote
                note={note}
                onEdit={() => onEdit(note.noteId)}
                onDelete={() => onDelete(note.noteId)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
});

function ExpandedPassageNote({
  note,
  onEdit,
  onDelete,
}: {
  note: VerseNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-200/70 bg-amber-50/60 dark:bg-amber-900/18 dark:border-amber-700/45 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <NoteContent content={note.content} className="flex-1" />
        <NoteCardActions
          onEdit={onEdit}
          onDelete={onDelete}
          variant="passage"
        />
      </div>
      <NoteTagList tags={note.tags} variant="passage" className="mt-1.5" />
    </div>
  );
}
