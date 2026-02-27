import { memo } from "react"
import { Pencil, Trash2, Plus, ChevronUp, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatVerseRef } from "@/lib/verse-ref-utils"
import type { VerseRef } from "@/lib/verse-ref-utils"
import type { Id } from "../../../convex/_generated/dataModel"

export interface VerseNote {
  noteId: Id<"notes">
  content: string
  tags: string[]
  verseRef: VerseRef
  createdAt: number
}

interface VerseNotesProps {
  notes: VerseNote[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onEdit: (noteId: Id<"notes">) => void
  onDelete: (noteId: Id<"notes">) => void
  onAddNote: () => void
}

export const VerseNotes = memo(function VerseNotes({
  notes,
  isOpen,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onAddNote,
}: VerseNotesProps) {
  if (notes.length === 0) return null

  if (!isOpen) {
    if (notes.length === 1) {
      return (
        <CollapsedBubble
          note={notes[0]}
          onClick={onOpen}
          onEdit={() => onEdit(notes[0].noteId)}
        />
      )
    }
    return (
      <StackedBubble
        count={notes.length}
        preview={notes[0].content}
        onClick={onOpen}
      />
    )
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
          <TooltipContent>Add new note</TooltipContent>
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
      {notes.map((note) => (
        <ExpandedBubble
          key={note.noteId}
          note={note}
          onEdit={() => onEdit(note.noteId)}
          onDelete={() => onDelete(note.noteId)}
        />
      ))}
    </div>
  )
})

function CollapsedBubble({
  note,
  onClick,
  onEdit,
}: {
  note: VerseNote
  onClick: () => void
  onEdit: () => void
}) {
  const preview =
    note.content.length > 100
      ? note.content.slice(0, 100) + "..."
      : note.content

  return (
    <div
      className="group relative border rounded-lg px-3 py-2 cursor-pointer transition-all hover:shadow-sm text-sm bg-card border-border"
      onClick={onClick}
    >
      <p className="text-muted-foreground line-clamp-2 leading-relaxed">
        {preview}
      </p>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Edit note</TooltipContent>
      </Tooltip>
    </div>
  )
}

function StackedBubble({
  count,
  preview,
  onClick,
}: {
  count: number
  preview: string
  onClick: () => void
}) {
  return (
    <div className="relative cursor-pointer" onClick={onClick}>
      {count > 2 && (
        <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg border bg-muted/40" />
      )}
      <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-lg border bg-muted/60" />
      <div className="relative border rounded-lg px-3 py-2 transition-all hover:shadow-sm text-sm bg-card border-border">
        <div className="flex items-center justify-between mb-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {count} notes
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {preview}
        </p>
      </div>
    </div>
  )
}

function ExpandedBubble({
  note,
  onEdit,
  onDelete,
}: {
  note: VerseNote
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="border rounded-lg px-3 py-2 shadow-sm text-sm bg-card border-border">
      <div className="flex items-start justify-between gap-2">
        <p className="leading-relaxed whitespace-pre-wrap flex-1">
          {note.content}
        </p>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded hover:bg-muted transition-colors"
                onClick={onEdit}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit note</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded hover:bg-destructive/10 transition-colors"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete note</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Passage Notes Bubble ────────────────────────────────────────────────────

interface PassageNotesBubbleProps {
  notes: VerseNote[]
  isOpen: boolean
  isGlowing: boolean
  compact?: boolean
  onOpen: () => void
  onClose: () => void
  onEdit: (noteId: Id<"notes">) => void
  onDelete: (noteId: Id<"notes">) => void
  onAddNote: () => void
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
}: PassageNotesBubbleProps) {
  if (notes.length === 0) return null

  if (!isOpen) {
    const previewLength = compact ? 60 : 100
    const preview =
      notes[0].content.length > previewLength
        ? notes[0].content.slice(0, previewLength) + "..."
        : notes[0].content

    return (
      <div
        className={cn(
          "group relative cursor-pointer rounded-lg border-l-2 border text-sm transition-all",
          "border-l-amber-400 border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800 dark:border-l-amber-500",
          "hover:shadow-sm hover:bg-amber-50 dark:hover:bg-amber-950/30",
          isGlowing && "animate-pulse-subtle ring-1 ring-amber-400/50 shadow-sm shadow-amber-200/60 dark:shadow-amber-950/60"
        )}
        onClick={onOpen}
      >
        <div className={cn("px-3 py-2", compact && "px-2.5 py-1.5")}>
          <div className="flex items-center gap-1.5 mb-1">
            <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className={cn("font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide truncate", compact ? "text-[9px]" : "text-[10px]")}>
              {formatVerseRef(notes[0].verseRef)}
            </span>
            {notes.length > 1 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 ml-auto shrink-0"
              >
                {notes.length}
              </Badge>
            )}
          </div>
          <p className={cn("text-muted-foreground leading-relaxed", compact ? "line-clamp-2 text-xs" : "line-clamp-2")}>
            {preview}
          </p>
          {!compact && notes[0].tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {notes[0].tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-amber-300 dark:border-amber-700"
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
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(notes[0].noteId)
                }}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit note</TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }

  // Expanded state
  return (
    <div
      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-800 p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
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
            <TooltipContent>Add new note</TooltipContent>
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
      {notes.map((note) => (
        <ExpandedPassageNote
          key={note.noteId}
          note={note}
          onEdit={() => onEdit(note.noteId)}
          onDelete={() => onDelete(note.noteId)}
        />
      ))}
    </div>
  )
})

function ExpandedPassageNote({
  note,
  onEdit,
  onDelete,
}: {
  note: VerseNote
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/60 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="leading-relaxed whitespace-pre-wrap flex-1">{note.content}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                onClick={onEdit}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit note</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded hover:bg-destructive/10 transition-colors"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete note</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-amber-300 dark:border-amber-700"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
