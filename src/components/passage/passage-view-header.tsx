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
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { shouldRevealReadingMode } from "@/lib/staged-onboarding-thresholds";
import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FeatureCallout } from "@/components/tutorial/feature-callout";

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
  /** Number of single-verse notes in this chapter, used for reading-mode reveal trigger. */
  chapterNotesCount: number;
  /** Maximum single-verse note count on any one verse in this chapter. */
  maxNotesPerVerse: number;
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
  chapterNotesCount,
  maxNotesPerVerse,
  setViewModeWithNotesReset,
  setNoteVisibility,
  onToggleFocusMode,
}: PassageViewHeaderProps) {
  const stagedOnboarding = useOptionalStagedOnboarding();
  const milestones = stagedOnboarding?.milestones;
  const readingRevealReached = milestones
    ? shouldRevealReadingMode(milestones, {
        chapterNotesCount,
        maxNotesPerVerse,
      })
    : false;
  const readingHint = useFeatureHint(
    FEATURE_HINTS.READING_MODE_REVEAL,
    readingRevealReached,
  );
  // Soft-hide rule: only show the Compose/Read toggle once Wave 5 has fired,
  // or once the user has acknowledged it. This way, restored state that puts
  // a returning user in read mode keeps the toggle visible too.
  const showViewModeToggle =
    readingRevealReached ||
    readingHint.completed ||
    readingHint.dismissed ||
    isReadMode;
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
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-2 py-1 transition-[background-color,border-color,box-shadow,color] duration-200",
                        isFocusMode
                          ? "border-primary/35 bg-primary/8 text-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.45),0_0_0_1px_hsl(var(--primary)/0.06),0_8px_24px_hsl(var(--primary)/0.10)]"
                          : "border-border bg-background",
                      )}
                    >
                      <label
                        htmlFor="passage-focus-mode"
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 text-xs font-medium transition-colors",
                          isFocusMode
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <Crosshair
                          className={cn(
                            "h-3 w-3 shrink-0 transition-colors",
                            isFocusMode && "text-primary",
                          )}
                          aria-hidden
                        />
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
              {showViewModeToggle ? (
                <FeatureCallout
                  state={readingHint}
                  title="Try Reading Mode"
                  description="This chapter has enough notes that Reading Mode can help you review them alongside the passage. Switch any time."
                  primaryActionLabel="Switch to Read"
                  onPrimaryAction={() => setViewModeWithNotesReset("read")}
                  side="bottom"
                  align="end"
                >
                  <div
                    className="inline-flex items-center rounded-md border bg-background p-0.5"
                    data-tour-id="passage-view-mode-toggle"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="xs"
                          variant={
                            effectiveViewMode === "compose"
                              ? "secondary"
                              : "ghost"
                          }
                          onClick={() => {
                            setViewModeWithNotesReset("compose");
                            if (
                              !readingHint.completed &&
                              !readingHint.dismissed
                            ) {
                              readingHint.complete();
                            }
                          }}
                          className="gap-1.5"
                        >
                          <Pencil className="h-3 w-3" />
                          Compose
                          <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                            C
                          </kbd>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Write and organize notes for the current passage.
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="xs"
                          variant={
                            effectiveViewMode === "read" ? "secondary" : "ghost"
                          }
                          onClick={() => {
                            setViewModeWithNotesReset("read");
                            if (
                              !readingHint.completed &&
                              !readingHint.dismissed
                            ) {
                              readingHint.complete();
                            }
                          }}
                          className="gap-1.5"
                        >
                          <BookOpen className="h-3 w-3" />
                          Read
                          <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                            R
                          </kbd>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Review your notes alongside the passage in a wider
                        layout.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </FeatureCallout>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
