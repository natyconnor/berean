import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import {
  NoteCardActions,
  NoteTagList,
  StackedCardBackground,
  HoverEditButton,
  NoteContent,
} from "@/components/notes/view/note-card-primitives";
import { NoteEditor } from "@/components/notes/note-editor";

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
  viewMode?: "compose" | "read";
  isPill?: boolean;
  editingNoteId?: Id<"notes"> | null;
  onOpen: () => void;
  onClose: () => void;
  onEdit: (noteId: Id<"notes">) => void;
  onDelete: (noteId: Id<"notes">) => void;
  onSaveEdit: (content: string, tags: string[]) => Promise<void>;
  onCancelEditing: () => void;
  onAddNote: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const VerseNotes = memo(function VerseNotes({
  notes,
  isOpen,
  viewMode = "compose",
  isPill = false,
  editingNoteId = null,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEditing,
  onAddNote,
  onMouseEnter,
  onMouseLeave,
}: VerseNotesProps) {
  if (notes.length === 0) return null;
  const isReadMode = viewMode === "read";

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {isPill ? (
        <motion.div key="pill" {...fadeInOut}>
          <VerseNotesPill count={notes.length} onClick={onOpen} />
        </motion.div>
      ) : !isOpen && !isReadMode ? (
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
          className={isReadMode ? "space-y-3" : "space-y-2"}
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
          {notes.map((note, index) => (
            <motion.div
              key={note.noteId}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: index * 0.03 }}
            >
              {editingNoteId === note.noteId ? (
                <NoteEditor
                  verseRef={note.verseRef}
                  initialContent={note.content}
                  initialTags={note.tags}
                  onSave={onSaveEdit}
                  onCancel={onCancelEditing}
                />
              ) : (
                <ExpandedBubble
                  note={note}
                  density={isReadMode ? "reading" : "default"}
                  onEdit={() => onEdit(note.noteId)}
                  onDelete={() => onDelete(note.noteId)}
                />
              )}
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
  density = "default",
  onEdit,
  onDelete,
}: {
  note: VerseNote;
  density?: "default" | "reading";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isReading = density === "reading";
  return (
    <div
      className={
        isReading
          ? "border rounded-xl px-4 py-3 shadow-sm bg-card border-border"
          : "border rounded-lg px-3 py-2 shadow-sm text-sm bg-card border-border"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <NoteContent
          content={note.content}
          density={density}
          className={isReading ? "flex-1 text-foreground" : "flex-1"}
        />
        <NoteCardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <NoteTagList tags={note.tags} size={isReading ? "sm" : "xs"} className="mt-2" />
    </div>
  );
}
