import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Plus, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NoteEditor } from "@/components/notes/note-editor";
import {
  NoteCardActions,
  NoteContent,
  NoteTagList,
} from "@/components/notes/view/note-card-primitives";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { cn } from "@/lib/utils";
import type { ChapterNotesPanelState } from "./hooks/use-chapter-notes-panel";
import {
  CHAPTER_OVERLAY_TRANSITION,
  CHAPTER_OVERLAY_VARIANTS,
  NOTE_CONTENT_VARIANTS,
  NOTE_ENTER_TRANSITION,
} from "./note-animation-config";
import {
  chapterNoteElevatedClass,
  chapterNoteInkClass,
  chapterNoteLineClass,
  chapterNoteSurfaceClass,
} from "./chapter-note-styles";

interface ChapterNotesChromeProps {
  panel: ChapterNotesPanelState;
  viewMode: "compose" | "read";
  /** Compose/read grid columns so the sticky overlay lines up with notes. */
  notesGridClass?: string;
}

/** Sticky floating chapter-notes panel over the notes column. */
export function ChapterNotesChrome({
  panel,
  viewMode,
  notesGridClass = "grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5",
}: ChapterNotesChromeProps) {
  const {
    chapterRef,
    notes,
    overlayOpen,
    drafting,
    editingId,
    closePanel,
    startDraft,
    cancelDraft,
    saveDraft,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteNote,
    setDirty,
  } = panel;

  const label = formatVerseRef(chapterRef);
  const isReadMode = viewMode === "read";

  return (
    <AnimatePresence>
      {overlayOpen ? (
        <motion.div
          key="chapter-notes-overlay"
          className="pointer-events-none absolute inset-0 z-30"
          variants={CHAPTER_OVERLAY_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={CHAPTER_OVERLAY_TRANSITION}
        >
          <div className={cn("sticky top-2 grid", notesGridClass)}>
            <div className="max-md:hidden" aria-hidden />
            <div
              data-note-surface
              className={cn(
                "pointer-events-auto flex min-h-[min(52vh,440px)] max-h-[min(85vh,720px)] flex-col overflow-hidden rounded-xl border",
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
                    {label}
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
                  {!drafting && notes.length > 0 && (
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
                <AnimatePresence initial={false} mode="popLayout">
                  {drafting && (
                    <motion.div
                      key="chapter-draft"
                      data-note-surface
                      variants={NOTE_CONTENT_VARIANTS}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={NOTE_ENTER_TRANSITION}
                      layout
                    >
                      <NoteEditor
                        verseRef={chapterRef}
                        variant="chapter"
                        currentChapter={{
                          book: chapterRef.book,
                          chapter: chapterRef.chapter,
                        }}
                        onSave={saveDraft}
                        onCancel={cancelDraft}
                        onDirtyChange={setDirty}
                      />
                    </motion.div>
                  )}

                  {notes.map((note) =>
                    editingId === note.noteId ? (
                      <motion.div
                        key={note.noteId}
                        data-note-surface
                        variants={NOTE_CONTENT_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={NOTE_ENTER_TRANSITION}
                        layout
                      >
                        <NoteEditor
                          verseRef={note.verseRef}
                          variant="chapter"
                          initialContent={note.content}
                          initialBody={note.body}
                          initialTags={note.tags}
                          currentChapter={{
                            book: chapterRef.book,
                            chapter: chapterRef.chapter,
                          }}
                          onSave={(body, tags) =>
                            saveEdit(note.noteId, body, tags)
                          }
                          onCancel={cancelEdit}
                          onDirtyChange={setDirty}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key={note.noteId}
                        data-note-surface
                        variants={NOTE_CONTENT_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={NOTE_ENTER_TRANSITION}
                        layout
                        className={cn(
                          // Tall enough for the stacked 32×32 edit/delete
                          // column so short one-line notes never clip trash.
                          "group min-h-[4.75rem] rounded-md border px-3 py-2.5",
                          chapterNoteSurfaceClass,
                          chapterNoteLineClass,
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <NoteContent
                              content={note.content}
                              body={note.body}
                              density={isReadMode ? "reading" : "default"}
                              currentChapter={{
                                book: chapterRef.book,
                                chapter: chapterRef.chapter,
                              }}
                            />
                            <NoteTagList
                              tags={note.tags}
                              className="mt-1.5"
                              size="xs"
                            />
                          </div>
                          <NoteCardActions
                            onEdit={() => startEdit(note.noteId)}
                            onDelete={() => {
                              void deleteNote(note.noteId);
                            }}
                            reveal={isReadMode ? "hover" : "always"}
                          />
                        </div>
                      </motion.div>
                    ),
                  )}
                </AnimatePresence>

                {!drafting && notes.length === 0 && (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    Capture something that spans the whole chapter.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
