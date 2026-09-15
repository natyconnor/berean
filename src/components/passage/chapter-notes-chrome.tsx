import { ChevronDown, ChevronUp, Plus, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NoteEditor } from "@/components/notes/note-editor";
import {
  HoverEditButton,
  NoteCardActions,
  NoteContent,
  NoteTagList,
} from "@/components/notes/view/note-card-primitives";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { cn } from "@/lib/utils";
import type { ChapterNotesPanelState } from "./hooks/use-chapter-notes-panel";
import {
  chapterNoteElevatedClass,
  chapterNoteInkClass,
  chapterNoteLineClass,
  chapterNoteSurfaceClass,
} from "./chapter-note-styles";

interface ChapterNotesChromeProps {
  panel: ChapterNotesPanelState;
  viewMode: "compose" | "read";
  /** When true, render only the text-column chapter row. */
  mode: "row" | "collapsed-slot" | "overlay";
  /** Compose/read grid columns so the sticky overlay lines up with notes. */
  notesGridClass?: string;
}

export function ChapterNotesChrome({
  panel,
  viewMode,
  mode,
  notesGridClass = "grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5",
}: ChapterNotesChromeProps) {
  const {
    chapterRef,
    notes,
    overlayOpen,
    drafting,
    editingId,
    openPanel,
    closePanel,
    startDraft,
    cancelDraft,
    saveDraft,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteNote,
    handleRowAdd,
    setDirty,
  } = panel;

  const label = formatVerseRef(chapterRef);

  if (mode === "row") {
    return (
      <div
        className={cn(
          "mb-1 flex items-center gap-2 rounded-md border border-dashed px-2 py-2",
          chapterNoteLineClass,
          chapterNoteSurfaceClass,
        )}
        data-passage-dismiss-exempt
      >
        <ScrollText className={cn("h-4 w-4 shrink-0", chapterNoteInkClass)} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              chapterNoteInkClass,
            )}
          >
            Chapter
          </p>
          <p className="text-sm text-muted-foreground">
            Notes for all of {label}
            {notes.length > 0 ? ` · ${notes.length}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRowAdd}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-background/80"
          aria-label={
            overlayOpen
              ? "Collapse chapter notes"
              : notes.length > 0
                ? "Open chapter notes"
                : "Add chapter note"
          }
          data-note-trigger
        >
          {overlayOpen ? (
            <ChevronUp className={cn("h-4 w-4", chapterNoteInkClass)} />
          ) : notes.length > 0 ? (
            <ChevronDown className={cn("h-4 w-4", chapterNoteInkClass)} />
          ) : (
            <Plus className={cn("h-4 w-4", chapterNoteInkClass)} />
          )}
        </button>
      </div>
    );
  }

  if (mode === "collapsed-slot") {
    // Always reserve height so expanding never shifts verse notes.
    return (
      <div
        className={cn("mb-1.5", overlayOpen && "invisible")}
        aria-hidden={overlayOpen}
      >
        {notes.length > 0 ? (
          <button
            type="button"
            onClick={openPanel}
            data-note-trigger
            className={cn(
              "group flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              chapterNoteSurfaceClass,
              chapterNoteLineClass,
              "hover:brightness-[0.99] dark:hover:brightness-110",
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
                  {label}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    chapterNoteLineClass,
                  )}
                >
                  {notes.length}
                </Badge>
              </div>
              <p className="line-clamp-2 text-[13px] text-foreground/90">
                {notes[0].content}
              </p>
              {notes.length > 1 ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  +{notes.length - 1} more · click to open
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Click to open
                </p>
              )}
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={startDraft}
            data-note-trigger
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm",
              chapterNoteLineClass,
              chapterNoteInkClass,
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add a chapter note
          </button>
        )}
      </div>
    );
  }

  // mode === "overlay"
  if (!overlayOpen) return null;

  const isReadMode = viewMode === "read";

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className={cn("sticky top-2 grid", notesGridClass)}>
        <div className="max-md:hidden" aria-hidden />
        <div
          data-note-surface
          className={cn(
            "pointer-events-auto flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-xl border",
            chapterNoteLineClass,
            chapterNoteElevatedClass,
            "cl-depth-4 shadow-none",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <ScrollText
                className={cn("h-3.5 w-3.5 shrink-0", chapterNoteInkClass)}
              />
              <span
                className={cn(
                  "truncate text-[10px] font-semibold uppercase tracking-wide",
                  chapterNoteInkClass,
                )}
              >
                {label} · Chapter
              </span>
              {notes.length > 0 ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    chapterNoteLineClass,
                  )}
                >
                  {notes.length}
                </Badge>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!drafting && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  onClick={startDraft}
                >
                  <Plus className="h-3 w-3" />
                  New note
                </button>
              )}
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={closePanel}
              >
                <ChevronUp className="h-3 w-3" />
                Collapse
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
            {drafting && (
              <div data-note-surface>
                <NoteEditor
                  verseRef={chapterRef}
                  currentChapter={{
                    book: chapterRef.book,
                    chapter: chapterRef.chapter,
                  }}
                  onSave={saveDraft}
                  onCancel={cancelDraft}
                  onDirtyChange={setDirty}
                />
              </div>
            )}

            {notes.map((note) =>
              editingId === note.noteId ? (
                <div key={note.noteId} data-note-surface>
                  <NoteEditor
                    verseRef={note.verseRef}
                    initialContent={note.content}
                    initialBody={note.body}
                    initialTags={note.tags}
                    currentChapter={{
                      book: chapterRef.book,
                      chapter: chapterRef.chapter,
                    }}
                    onSave={(body, tags) => saveEdit(note.noteId, body, tags)}
                    onCancel={cancelEdit}
                    onDirtyChange={setDirty}
                  />
                </div>
              ) : (
                <div
                  key={note.noteId}
                  data-note-surface
                  className={cn(
                    "group relative rounded-md border px-3 py-2",
                    chapterNoteSurfaceClass,
                    chapterNoteLineClass,
                  )}
                >
                  <NoteContent
                    content={note.content}
                    body={note.body}
                    density={isReadMode ? "reading" : "default"}
                    currentChapter={{
                      book: chapterRef.book,
                      chapter: chapterRef.chapter,
                    }}
                    className="pr-8"
                  />
                  <NoteTagList tags={note.tags} className="mt-1.5" size="xs" />
                  <div className="absolute right-1.5 top-1.5">
                    {isReadMode ? (
                      <HoverEditButton onEdit={() => startEdit(note.noteId)} />
                    ) : (
                      <NoteCardActions
                        onEdit={() => startEdit(note.noteId)}
                        onDelete={() => {
                          void deleteNote(note.noteId);
                        }}
                      />
                    )}
                  </div>
                </div>
              ),
            )}

            {!drafting && notes.length === 0 && (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                Capture something that spans the whole chapter.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
