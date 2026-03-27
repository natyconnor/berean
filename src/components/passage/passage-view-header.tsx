"use client";

import { BookOpen, Crosshair, Pencil } from "lucide-react";
import { ChapterHeader } from "@/components/bible/chapter-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PassageViewMode = "compose" | "read";
type NoteVisibility = "all" | "noted";

interface PassageViewHeaderProps {
  book: string;
  chapter: number;
  isScrolled: boolean;
  passageGridClass: string;
  headerInnerClass: string;
  effectiveViewMode: PassageViewMode;
  isReadMode: boolean;
  isFocusMode: boolean;
  hasAnyNotes: boolean;
  noteVisibility: NoteVisibility;
  setViewModeWithNotesReset: (next: PassageViewMode) => void;
  setNoteVisibility: (next: NoteVisibility) => void;
  onToggleFocusMode: () => void;
}

export function PassageViewHeader({
  book,
  chapter,
  isScrolled,
  passageGridClass,
  headerInnerClass,
  effectiveViewMode,
  isReadMode,
  isFocusMode,
  hasAnyNotes,
  noteVisibility,
  setViewModeWithNotesReset,
  setNoteVisibility,
  onToggleFocusMode,
}: PassageViewHeaderProps) {
  return (
    <div
      className={cn(
        "shrink-0 transition-[box-shadow,border-color] duration-200",
        "bg-background",
        isScrolled && "shadow-sm",
      )}
      data-passage-dismiss-exempt
    >
      <div className={cn("grid", passageGridClass, headerInnerClass)}>
        <div className="flex items-center">
          <ChapterHeader book={book} chapter={chapter} />
        </div>
        <div className="pb-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </span>
            <div className="flex items-center gap-2">
              {!isReadMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                      <label
                        htmlFor="passage-focus-mode"
                        className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground"
                      >
                        <Crosshair className="h-3 w-3 shrink-0" aria-hidden />
                        Focus
                        <kbd className="rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                          F
                        </kbd>
                      </label>
                      <Switch
                        id="passage-focus-mode"
                        checked={isFocusMode}
                        onCheckedChange={(checked) => {
                          if (checked !== isFocusMode) {
                            onToggleFocusMode();
                          }
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFocusMode ? "Turn off focus mode" : "Turn on focus mode"}
                  </TooltipContent>
                </Tooltip>
              )}
              {isReadMode && hasAnyNotes && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show</span>
                  <div className="inline-flex items-center rounded-md border bg-background p-0.5">
                    <Button
                      size="xs"
                      variant={noteVisibility === "all" ? "secondary" : "ghost"}
                      onClick={() => setNoteVisibility("all")}
                    >
                      All Verses
                    </Button>
                    <Button
                      size="xs"
                      variant={
                        noteVisibility === "noted" ? "secondary" : "ghost"
                      }
                      onClick={() => setNoteVisibility("noted")}
                    >
                      Only Verses with Notes
                    </Button>
                  </div>
                </div>
              )}
              {isReadMode && !hasAnyNotes && (
                <p className="text-xs text-muted-foreground italic">
                  No notes for this chapter
                </p>
              )}
              <div
                className="inline-flex items-center rounded-md border bg-background p-0.5"
                data-tour-id="passage-view-mode-toggle"
              >
                <Button
                  size="xs"
                  variant={
                    effectiveViewMode === "compose" ? "secondary" : "ghost"
                  }
                  onClick={() => setViewModeWithNotesReset("compose")}
                  className="gap-1.5"
                >
                  <Pencil className="h-3 w-3" />
                  Compose
                  <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                    C
                  </kbd>
                </Button>
                <Button
                  size="xs"
                  variant={effectiveViewMode === "read" ? "secondary" : "ghost"}
                  onClick={() => setViewModeWithNotesReset("read")}
                  className="gap-1.5"
                >
                  <BookOpen className="h-3 w-3" />
                  Read
                  <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                    R
                  </kbd>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
