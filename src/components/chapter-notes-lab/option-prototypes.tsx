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
  chapterNoteElevatedClass,
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

const CHAPTER_ROW_VERSE_NOTES: Record<number, string> = {
  3: LAB_VERSE_NOTE.content,
  8: "Wind / Spirit wordplay lands harder when you hold vv. 1–12 together.",
  10: "Teacher of Israel — the irony bites only if the whole night conversation is still in view.",
};

export function OptionChapterRow() {
  const state = useChapterNotesState([SEED_CHAPTER_NOTE], {
    initialExpanded: false,
  });
  const overlayOpen = state.expanded || state.drafting;

  function openChapterNotes() {
    if (state.notes.length > 0) state.setExpanded(true);
    else state.startDraft();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background px-4">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5">
          <LabChapterHeader />
          <NotesColumnLabel
            action={
              overlayOpen ? (
                <span className={cn("text-[11px]", chapterNoteInkClass)}>
                  Floating above verse notes — scroll the text freely
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Expand the chapter pill; verse notes stay lined up
                </span>
              )
            }
          />
        </div>
      </div>

      {/* Shared scroll keeps verse notes locked to their verses */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-2">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start">
          {/* Chapter row entry */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border border-dashed px-2 py-2",
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
              onClick={() => {
                if (overlayOpen) state.toggleExpanded();
                else openChapterNotes();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-background/80"
              aria-label={
                overlayOpen ? "Collapse chapter notes" : "Open chapter notes"
              }
            >
              <Plus className={cn("h-4 w-4", chapterNoteInkClass)} />
            </button>
          </div>

          {/* Collapsed pill always reserves its slot so expand never shifts verse notes */}
          <div
            className={cn(overlayOpen && "invisible")}
            aria-hidden={overlayOpen}
          >
            {state.notes.length > 0 ? (
              <ChapterNotesList
                notes={state.notes}
                expanded={false}
                drafting={false}
                editingId={null}
                onToggleExpanded={openChapterNotes}
                onStartDraft={state.startDraft}
                onCancelDraft={state.cancelDraft}
                onSaveDraft={state.saveDraft}
                onStartEdit={state.startEdit}
                onCancelEdit={state.cancelEdit}
                onSaveEdit={state.saveEdit}
                onDelete={state.deleteNote}
              />
            ) : (
              <button
                type="button"
                onClick={state.startDraft}
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
        </div>

        {LAB_VERSES.map((verse) => (
          <div
            key={verse.number}
            className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start py-1.5"
          >
            <div className="group flex gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40">
              <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
                {verse.number}
              </span>
              <p className="flex-1 font-serif text-[15px] leading-relaxed">
                {verse.text}
              </p>
              <button
                type="button"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                aria-label={`Add note for ${verse.number}`}
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div>
              {CHAPTER_ROW_VERSE_NOTES[verse.number] ? (
                <MockVerseNoteCard
                  content={CHAPTER_ROW_VERSE_NOTES[verse.number]}
                />
              ) : null}
            </div>
          </div>
        ))}

        {/* Solid elevated overlay — floats over notes column; verse notes stay put underneath */}
        {overlayOpen && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="sticky top-2 grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 px-0">
              <div />
              <div
                className={cn(
                  "pointer-events-auto flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-xl border",
                  chapterNoteLineClass,
                  chapterNoteElevatedClass,
                  "cl-depth-4 shadow-none",
                )}
              >
                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
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
                    className="border-0 bg-transparent p-0 shadow-none dark:bg-transparent"
                  />
                </div>
                <p className="shrink-0 border-t px-3 py-2 text-[11px] text-muted-foreground">
                  Verse notes stay lined up underneath — this card just floats
                  above them.
                </p>
              </div>
            </div>
          </div>
        )}
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
