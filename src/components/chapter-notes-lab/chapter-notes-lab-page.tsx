import { useState, type JSX } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CHAPTER_NOTES_OPTIONS, type ChapterNotesOptionId } from "./options";
import {
  OptionChapterRow,
  OptionHeaderRail,
  OptionNotesTray,
  OptionPinnedDock,
} from "./option-prototypes";

const OPTION_VIEWS: Record<ChapterNotesOptionId, () => JSX.Element> = {
  "header-rail": OptionHeaderRail,
  "chapter-row": OptionChapterRow,
  "notes-tray": OptionNotesTray,
  "pinned-dock": OptionPinnedDock,
};

export function ChapterNotesLabPage() {
  const [selectedId, setSelectedId] =
    useState<ChapterNotesOptionId>("header-rail");
  const selected =
    CHAPTER_NOTES_OPTIONS.find((option) => option.id === selectedId) ??
    CHAPTER_NOTES_OPTIONS[0];
  const ActiveView = OPTION_VIEWS[selected.id];

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <aside className="flex w-[320px] shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold">Chapter notes lab</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Local prototypes only — nothing is saved.
              </p>
            </div>
            <Link
              to="/"
              className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              ← App
            </Link>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {CHAPTER_NOTES_OPTIONS.map((option) => {
            const isActive = option.id === selected.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedId(option.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background hover:bg-muted/40",
                )}
              >
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {option.shortLabel}
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {option.title}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {option.summary}
                </p>
              </button>
            );
          })}
        </div>

        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Try this option</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Entry: {selected.entryPoint}</li>
            <li>Lives: {selected.placement}</li>
          </ul>
          <p className="mt-2 font-medium text-foreground">Tradeoffs</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {selected.tradeoffs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        <ActiveView />
      </main>
    </div>
  );
}
