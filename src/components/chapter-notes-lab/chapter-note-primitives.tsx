import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Pencil, Plus, ScrollText, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LabChapterNote } from "./lab-types";
import { LAB_BOOK, LAB_CHAPTER } from "./lab-types";
import {
  chapterNoteInkClass,
  chapterNoteLineClass,
  chapterNoteSurfaceClass,
  chapterNoteSurfaceSoftClass,
} from "./chapter-note-styles";

interface ChapterNoteEditorProps {
  initialContent?: string;
  initialTags?: string[];
  onSave: (content: string, tags: string[]) => void;
  onCancel: () => void;
}

export function ChapterNoteEditor({
  initialContent = "",
  initialTags = [],
  onSave,
  onCancel,
}: ChapterNoteEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [tagDraft, setTagDraft] = useState(initialTags.join(", "));

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    const tags = tagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onSave(trimmed, tags);
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        chapterNoteSurfaceClass,
        chapterNoteLineClass,
      )}
    >
      <div className="flex items-center gap-1.5">
        <ScrollText className={cn("h-3.5 w-3.5", chapterNoteInkClass)} />
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            chapterNoteInkClass,
          )}
        >
          {LAB_BOOK} {LAB_CHAPTER} · Chapter note
        </span>
      </div>
      <textarea
        autoFocus
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Write a note for the whole chapter…"
        rows={4}
        className="w-full resize-none rounded-md border bg-background/70 px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <input
        value={tagDraft}
        onChange={(event) => setTagDraft(event.target.value)}
        placeholder="Tags (comma-separated)"
        className="w-full rounded-md border bg-background/70 px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
          <X className="h-3 w-3" />
          Cancel
        </Button>
        <Button
          type="button"
          size="xs"
          onClick={handleSave}
          disabled={!content.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

interface ChapterNotesListProps {
  notes: LabChapterNote[];
  expanded: boolean;
  drafting: boolean;
  editingId: string | null;
  onToggleExpanded: () => void;
  onStartDraft: () => void;
  onCancelDraft: () => void;
  onSaveDraft: (content: string, tags: string[]) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string, tags: string[]) => void;
  onDelete: (id: string) => void;
  compactHeader?: boolean;
  className?: string;
}

export function ChapterNotesList({
  notes,
  expanded,
  drafting,
  editingId,
  onToggleExpanded,
  onStartDraft,
  onCancelDraft,
  onSaveDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  compactHeader = false,
  className,
}: ChapterNotesListProps) {
  if (!expanded && !drafting && notes.length === 0) {
    return null;
  }

  if (!expanded && !drafting && notes.length > 0) {
    return (
      <button
        type="button"
        onClick={onToggleExpanded}
        className={cn(
          "group flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
          chapterNoteSurfaceClass,
          chapterNoteLineClass,
          "hover:brightness-[0.99] dark:hover:brightness-110",
          className,
        )}
      >
        <ScrollText
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", chapterNoteInkClass)}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                chapterNoteInkClass,
              )}
            >
              {LAB_BOOK} {LAB_CHAPTER}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", chapterNoteLineClass)}
            >
              {notes.length}
            </Badge>
          </div>
          <p className="line-clamp-2 text-[13px] text-foreground/90">
            {notes[0].content}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-2.5",
        chapterNoteSurfaceSoftClass,
        chapterNoteLineClass,
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-1",
          compactHeader && "pb-0.5",
        )}
      >
        <div className="flex items-center gap-1.5">
          <ScrollText className={cn("h-3.5 w-3.5", chapterNoteInkClass)} />
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              chapterNoteInkClass,
            )}
          >
            {LAB_BOOK} {LAB_CHAPTER} · Chapter
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!drafting && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              onClick={onStartDraft}
            >
              <Plus className="h-3 w-3" />
              New note
            </button>
          )}
          {(notes.length > 0 || drafting) && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (drafting) onCancelDraft();
                onToggleExpanded();
              }}
            >
              <ChevronUp className="h-3 w-3" />
              Collapse
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {drafting && (
          <motion.div
            key="draft"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <ChapterNoteEditor onSave={onSaveDraft} onCancel={onCancelDraft} />
          </motion.div>
        )}
        {notes.map((note) =>
          editingId === note.id ? (
            <motion.div key={`edit-${note.id}`} layout>
              <ChapterNoteEditor
                initialContent={note.content}
                initialTags={note.tags}
                onSave={(content, tags) => onSaveEdit(note.id, content, tags)}
                onCancel={onCancelEdit}
              />
            </motion.div>
          ) : (
            <motion.div
              key={note.id}
              layout
              className={cn(
                "group relative rounded-md border px-3 py-2",
                chapterNoteSurfaceClass,
                chapterNoteLineClass,
              )}
            >
              <p className="pr-8 text-[13px] leading-relaxed text-foreground/95">
                {note.content}
              </p>
              {note.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        chapterNoteLineClass,
                      )}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="absolute right-1.5 top-1.5 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted"
                  aria-label="Edit chapter note"
                  onClick={() => onStartEdit(note.id)}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10"
                  aria-label="Delete chapter note"
                  onClick={() => onDelete(note.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

export function MockVerseNoteCard({ content }: { content: string }) {
  return (
    <div className="rounded-lg bg-card px-3 py-2 text-[13px] leading-relaxed cl-depth-1 shadow-none">
      <p className="text-foreground/90">{content}</p>
    </div>
  );
}

export function MockVerseRow({
  number,
  text,
  showAdd = true,
  onAdd,
  trailing,
}: {
  number: number | string;
  text: string;
  showAdd?: boolean;
  onAdd?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start py-1.5">
      <div className="group flex gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
        <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
          {number}
        </span>
        <p className="flex-1 text-[15px] leading-relaxed font-serif">{text}</p>
        {showAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
            aria-label={`Add note for ${number}`}
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="min-h-6">{trailing}</div>
    </div>
  );
}
