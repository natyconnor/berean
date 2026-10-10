"use client";

import { BookOpen, Crosshair, Pencil } from "lucide-react";
import { ChapterHeader } from "@/components/bible/chapter-header";
import { Button } from "@/components/ui/button";
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
import {
  NOTES_CHROME_COMPACT_HIDE_CLASS,
  NOTES_CHROME_COMPACT_LABEL_CLASS,
  NOTES_CHROME_COMPACT_SHORT_CLASS,
  NOTES_CHROME_COMPACT_SR_CLASS,
  PASSAGE_HEADER_CONTAINER_CLASS,
  SHORTCUT_KBD_CLASS,
} from "./header-chrome";
import { HeaderShortcutToggle } from "./header-shortcut-toggle";

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
  showSectionHeaders: boolean;
  hasAnyNotes: boolean;
  noteVisibility: NoteVisibility;
  /** Number of single-verse notes in this chapter, used for reading-mode reveal trigger. */
  chapterNotesCount: number;
  /** Maximum single-verse note count on any one verse in this chapter. */
  maxNotesPerVerse: number;
  setViewModeWithNotesReset: (next: PassageViewMode) => void;
  setNoteVisibility: (next: NoteVisibility) => void;
  onToggleFocusMode: () => void;
  onToggleSectionHeaders: () => void;
  /** Whole-chapter notes for the sticky header chrome. */
  chapterScopedNoteCount?: number;
  /** Floating chapter panel is open (header button toggles closed). */
  chapterNotesOpen?: boolean;
  onChapterNotesClick?: () => void;
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
  showSectionHeaders,
  hasAnyNotes,
  noteVisibility,
  chapterNotesCount,
  maxNotesPerVerse,
  setViewModeWithNotesReset,
  setNoteVisibility,
  onToggleFocusMode,
  onToggleSectionHeaders,
  chapterScopedNoteCount = 0,
  chapterNotesOpen = false,
  onChapterNotesClick,
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
      <div
        className={cn(
          PASSAGE_HEADER_CONTAINER_CLASS,
          "grid",
          passageGridClass,
          headerInnerClass,
        )}
      >
        <div className="flex w-full min-w-0 items-center">
          <ChapterHeader
            book={book}
            chapter={chapter}
            showSectionHeaders={showSectionHeaders}
            onToggleSectionHeaders={onToggleSectionHeaders}
            chapterScopedNoteCount={chapterScopedNoteCount}
            chapterNotesOpen={chapterNotesOpen}
            onChapterNotesClick={onChapterNotesClick}
          />
        </div>
        <div className="min-w-0 pb-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="shrink-0 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </span>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {!isReadMode && (
                <HeaderShortcutToggle
                  id="passage-focus-mode"
                  label="Focus"
                  shortcut="F"
                  checked={isFocusMode}
                  onToggle={onToggleFocusMode}
                  compactLabelClassName={NOTES_CHROME_COMPACT_LABEL_CLASS}
                  tooltip={
                    isFocusMode ? "Turn off focus mode" : "Turn on focus mode"
                  }
                  icon={
                    <Crosshair
                      className={cn(
                        "h-3 w-3 shrink-0 transition-colors",
                        isFocusMode && "text-primary",
                      )}
                      aria-hidden
                    />
                  }
                  className={
                    isFocusMode
                      ? "border-primary/35 bg-primary/8 text-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.45),0_0_0_1px_hsl(var(--primary)/0.06),0_8px_24px_hsl(var(--primary)/0.10)]"
                      : "border-border bg-background"
                  }
                  labelClassName={
                    isFocusMode ? "text-foreground" : "text-muted-foreground"
                  }
                />
              )}
              {isReadMode && hasAnyNotes && (
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "text-xs text-muted-foreground",
                      NOTES_CHROME_COMPACT_HIDE_CLASS,
                    )}
                  >
                    Show
                  </span>
                  <div className="inline-flex items-center rounded-md border bg-background p-0.5">
                    <Button
                      size="xs"
                      variant={noteVisibility === "all" ? "secondary" : "ghost"}
                      onClick={() => setNoteVisibility("all")}
                    >
                      <span className={NOTES_CHROME_COMPACT_SR_CLASS}>
                        All Verses
                      </span>
                      <span
                        aria-hidden="true"
                        className={NOTES_CHROME_COMPACT_SHORT_CLASS}
                      >
                        All
                      </span>
                    </Button>
                    <Button
                      size="xs"
                      variant={
                        noteVisibility === "noted" ? "secondary" : "ghost"
                      }
                      onClick={() => setNoteVisibility("noted")}
                    >
                      <span className={NOTES_CHROME_COMPACT_SR_CLASS}>
                        <span className="@max-6xl/passage-header:hidden">
                          Only Verses with Notes
                        </span>
                        <span className="hidden @max-6xl/passage-header:inline">
                          Noted, Only Verses with Notes
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={NOTES_CHROME_COMPACT_SHORT_CLASS}
                      >
                        Noted
                      </span>
                    </Button>
                  </div>
                </div>
              )}
              {isReadMode && !hasAnyNotes && (
                <p className="text-xs text-muted-foreground italic">
                  <span className={NOTES_CHROME_COMPACT_HIDE_CLASS}>
                    No notes for this chapter
                  </span>
                  <span className={NOTES_CHROME_COMPACT_SHORT_CLASS}>
                    No notes
                  </span>
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
                          <span className={NOTES_CHROME_COMPACT_LABEL_CLASS}>
                            Compose
                          </span>
                          <kbd className={cn("ml-1", SHORTCUT_KBD_CLASS)}>
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
                          <span className={NOTES_CHROME_COMPACT_LABEL_CLASS}>
                            Read
                          </span>
                          <kbd className={cn("ml-1", SHORTCUT_KBD_CLASS)}>
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
