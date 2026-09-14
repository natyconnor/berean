import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChapterNotesList,
  MockVerseNoteCard,
  MockVerseRow,
} from "./chapter-note-primitives";
import {
  chapterNoteInkClass,
  chapterNoteLineClass,
  chapterNoteSurfaceClass,
  chapterNoteSurfaceSoftClass,
} from "./chapter-note-styles";
import { useChapterNotesState } from "./use-chapter-notes-state";
import {
  LAB_BOOK,
  LAB_CHAPTER,
  LAB_VERSES,
  LAB_VERSE_NOTE,
  SEED_CHAPTER_NOTE,
} from "./lab-types";

function LabChapterHeader({ trailing }: { trailing?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Previous chapter"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="rounded-lg bg-muted/30 px-3 py-1 text-2xl font-serif font-semibold tracking-tight">
          {LAB_BOOK} {LAB_CHAPTER}
        </h2>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Next chapter"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {trailing}
    </div>
  );
}

function NotesColumnLabel({ action }: { action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2 pt-1">
      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Notes
      </span>
      {action}
    </div>
  );
}

export function OptionHeaderRail() {
  const state = useChapterNotesState([SEED_CHAPTER_NOTE]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background px-4">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5">
          <LabChapterHeader />
          <NotesColumnLabel
            action={
              <Button
                type="button"
                size="xs"
                variant="outline"
                className={cn("gap-1", chapterNoteLineClass)}
                onClick={state.startDraft}
              >
                <Plus className="h-3 w-3" />
                Chapter
              </Button>
            }
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-2">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start">
          <div />
          <div className="sticky top-2 z-10 space-y-2">
            <ChapterNotesList
              notes={state.notes}
              expanded={state.expanded}
              drafting={state.drafting}
              editingId={state.editingId}
              onToggleExpanded={state.toggleExpanded}
              onStartDraft={state.startDraft}
              onCancelDraft={state.cancelDraft}
              onSaveDraft={state.saveDraft}
              onStartEdit={state.startEdit}
              onCancelEdit={state.cancelEdit}
              onSaveEdit={state.saveEdit}
              onDelete={state.deleteNote}
            />
          </div>
        </div>
        {LAB_VERSES.map((verse) => (
          <MockVerseRow
            key={verse.number}
            number={verse.number}
            text={verse.text}
            trailing={
              verse.number === LAB_VERSE_NOTE.verse ? (
                <MockVerseNoteCard content={LAB_VERSE_NOTE.content} />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export function OptionChapterRow() {
  const state = useChapterNotesState([SEED_CHAPTER_NOTE]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background px-4">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5">
          <LabChapterHeader />
          <NotesColumnLabel />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-2">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start py-1.5">
          <div
            className={cn(
              "group flex items-center gap-2 rounded-md border border-dashed px-2 py-2",
              chapterNoteLineClass,
              chapterNoteSurfaceClass,
            )}
          >
            <ScrollText
              className={cn("h-4 w-4 shrink-0", chapterNoteInkClass)}
            />
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
                Notes that cover all of {LAB_BOOK} {LAB_CHAPTER}
              </p>
            </div>
            <button
              type="button"
              onClick={state.startDraft}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-background/80"
              aria-label="Add chapter note"
            >
              <Plus className={cn("h-4 w-4", chapterNoteInkClass)} />
            </button>
          </div>
          <ChapterNotesList
            notes={state.notes}
            expanded={state.expanded}
            drafting={state.drafting}
            editingId={state.editingId}
            onToggleExpanded={state.toggleExpanded}
            onStartDraft={state.startDraft}
            onCancelDraft={state.cancelDraft}
            onSaveDraft={state.saveDraft}
            onStartEdit={state.startEdit}
            onCancelEdit={state.cancelEdit}
            onSaveEdit={state.saveEdit}
            onDelete={state.deleteNote}
          />
        </div>
        {LAB_VERSES.map((verse) => (
          <MockVerseRow
            key={verse.number}
            number={verse.number}
            text={verse.text}
            trailing={
              verse.number === LAB_VERSE_NOTE.verse ? (
                <MockVerseNoteCard content={LAB_VERSE_NOTE.content} />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export function OptionNotesTray() {
  const state = useChapterNotesState([SEED_CHAPTER_NOTE]);
  const trayOpen = state.expanded || state.drafting;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background px-4">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5">
          <LabChapterHeader />
          <div className="pb-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (trayOpen) {
                  state.toggleExpanded();
                } else {
                  state.setExpanded(true);
                }
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                trayOpen
                  ? cn(chapterNoteSurfaceClass, chapterNoteLineClass)
                  : "border-border bg-background hover:bg-muted/40",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                    chapterNoteLineClass,
                    chapterNoteInkClass,
                  )}
                >
                  <ScrollText className="h-3 w-3" />
                  Chapter
                  {state.notes.length > 0 ? ` · ${state.notes.length}` : ""}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                {trayOpen ? "Hide chapter notes" : "Open chapter notes"}
              </span>
            </button>
            {trayOpen && (
              <div className="mt-2">
                <ChapterNotesList
                  notes={state.notes}
                  expanded
                  drafting={state.drafting}
                  editingId={state.editingId}
                  onToggleExpanded={state.toggleExpanded}
                  onStartDraft={state.startDraft}
                  onCancelDraft={state.cancelDraft}
                  onSaveDraft={state.saveDraft}
                  onStartEdit={state.startEdit}
                  onCancelEdit={state.cancelEdit}
                  onSaveEdit={state.saveEdit}
                  onDelete={state.deleteNote}
                  compactHeader
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-2">
        {LAB_VERSES.map((verse) => (
          <MockVerseRow
            key={verse.number}
            number={verse.number}
            text={verse.text}
            trailing={
              verse.number === LAB_VERSE_NOTE.verse ? (
                <MockVerseNoteCard content={LAB_VERSE_NOTE.content} />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export function OptionPinnedDock() {
  const state = useChapterNotesState([SEED_CHAPTER_NOTE]);
  const open = state.expanded || state.drafting;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background px-4">
        <LabChapterHeader />
        <div
          className={cn(
            "mb-3 overflow-hidden rounded-lg border transition-[box-shadow]",
            chapterNoteLineClass,
            open && "shadow-sm",
          )}
        >
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
              chapterNoteSurfaceClass,
            )}
            onClick={() => {
              if (open) state.toggleExpanded();
              else state.setExpanded(true);
            }}
          >
            <span className="flex items-center gap-2">
              <ScrollText className={cn("h-4 w-4", chapterNoteInkClass)} />
              <span className="text-sm font-medium">
                Chapter notes
                {state.notes.length > 0 ? (
                  <span className={cn("ml-1.5 text-xs", chapterNoteInkClass)}>
                    ({state.notes.length})
                  </span>
                ) : null}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {open ? "Collapse" : "Expand · stays pinned while you scroll"}
            </span>
          </button>
          {open && (
            <div className={cn("border-t p-2.5", chapterNoteSurfaceSoftClass)}>
              <ChapterNotesList
                notes={state.notes}
                expanded
                drafting={state.drafting}
                editingId={state.editingId}
                onToggleExpanded={state.toggleExpanded}
                onStartDraft={state.startDraft}
                onCancelDraft={state.cancelDraft}
                onSaveDraft={state.saveDraft}
                onStartEdit={state.startEdit}
                onCancelEdit={state.cancelEdit}
                onSaveEdit={state.saveEdit}
                onDelete={state.deleteNote}
                compactHeader
                className="border-0 bg-transparent p-0 dark:bg-transparent"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5">
          <div />
          <NotesColumnLabel />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-2">
        {LAB_VERSES.map((verse) => (
          <MockVerseRow
            key={verse.number}
            number={verse.number}
            text={verse.text}
            trailing={
              verse.number === LAB_VERSE_NOTE.verse ? (
                <MockVerseNoteCard content={LAB_VERSE_NOTE.content} />
              ) : undefined
            }
          />
        ))}
        {/* Extra verses so scrolling the dock is obvious */}
        {[6, 7, 8, 9, 10].map((number) => (
          <MockVerseRow
            key={number}
            number={number}
            text="(Extra verse for scroll testing — dock should stay pinned above.)"
            showAdd={false}
          />
        ))}
      </div>
    </div>
  );
}
