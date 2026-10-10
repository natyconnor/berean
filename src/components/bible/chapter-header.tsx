import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { displayBookName } from "@/lib/bible-books";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import { formatBookChapter } from "@/lib/verse-ref-utils";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";
import {
  chapterNoteInkClass,
  chapterNoteSurfaceClass,
} from "@/components/passage/chapter-note-styles";
import {
  CHAPTER_CHROME_COMPACT_HIDE_CLASS,
  CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS,
  CHAPTER_CHROME_COMPACT_LABEL_CLASS,
  CHAPTER_CHROME_CONTAINER_CLASS,
  CHAPTER_CHROME_TIGHT_HIDE_CLASS,
} from "@/components/passage/header-chrome";
import { HeaderShortcutToggle } from "@/components/passage/header-shortcut-toggle";
import {
  CHAPTER_CHROME_TRANSITION,
  CHAPTER_HEADER_CTA_VARIANTS,
} from "@/components/passage/note-animation-config";
import { PassageNavigator } from "./passage-navigator";

/**
 * Book and chapter open different pickers, so each needs its own target. At
 * rest the pair reads as one reference carved into the page; hovering or
 * focusing the well slides a caret into each segment so both hit areas become
 * obvious, and only the segment under the pointer takes a fill.
 *
 * The well sits between the edge-pinned pager arrows, so the caret space grows
 * outward from the center: the book text slides left while the chapter number
 * holds position, keeping whichever segment the pointer is over under it.
 */
const REFERENCE_WELL_CLASS =
  "group/ref flex min-w-0 items-center rounded-lg bg-muted/30 px-1 py-0.5 cl-well dark:bg-muted/40";
const REFERENCE_SEGMENT_CLASS =
  "h-auto gap-0 rounded-md px-2 py-0.5 text-2xl font-serif font-semibold tracking-tight hover:bg-primary/10 dark:hover:bg-primary/15";
/** Matches the Candlelight easing used by `cl-transition`. */
const REFERENCE_CARET_SLOT_CLASS =
  "flex w-0 shrink-0 justify-end overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ref:w-5 group-hover/ref:opacity-100 group-focus-within/ref:w-5 group-focus-within/ref:opacity-100 motion-reduce:transition-none";
const REFERENCE_CARET_CLASS =
  "size-3.5 -translate-x-1 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ref:translate-x-0 group-focus-within/ref:translate-x-0 motion-reduce:transition-none";

function ReferenceCaret() {
  return (
    <span aria-hidden className={REFERENCE_CARET_SLOT_CLASS}>
      <ChevronDown className={REFERENCE_CARET_CLASS} />
    </span>
  );
}

interface ChapterHeaderProps {
  book: string;
  chapter: number;
  showSectionHeaders: boolean;
  onToggleSectionHeaders: () => void;
  /** Whole-chapter notes for the sticky header chrome. */
  chapterScopedNoteCount?: number;
  /** Floating chapter panel is open (button toggles closed). */
  chapterNotesOpen?: boolean;
  onChapterNotesClick?: () => void;
}

export function ChapterHeader({
  book,
  chapter,
  showSectionHeaders,
  onToggleSectionHeaders,
  chapterScopedNoteCount = 0,
  chapterNotesOpen = false,
  onChapterNotesClick,
}: ChapterHeaderProps) {
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);
  const hasPrev = previous !== null;
  const hasNext = next !== null;
  const passageShortcutLabel = formatCommandOrControlShortcut("G");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorBook, setNavigatorBook] = useState<string | null>(null);

  const chapterLabel = formatBookChapter(book, chapter);
  const hasChapterNotes = chapterScopedNoteCount > 0;
  const chapterNotesSubtitle = hasChapterNotes
    ? `Notes for all of ${chapterLabel} · ${chapterScopedNoteCount}`
    : "Add a chapter note";
  const chapterNotesAction = chapterNotesOpen
    ? "Close chapter notes"
    : hasChapterNotes
      ? "Open chapter notes"
      : "Add a chapter note";
  // Compact chrome hides the count subtitle, so the tooltip keeps it.
  const chapterNotesTooltip = hasChapterNotes
    ? `${chapterNotesAction} · ${chapterScopedNoteCount}`
    : chapterNotesAction;

  function goPrev() {
    if (!previous) return;
    navigateActiveTab(previous.passageId, previous.label);
  }

  function goNext() {
    if (!next) return;
    navigateActiveTab(next.passageId, next.label);
  }

  function openBookNavigator() {
    setNavigatorBook(null);
    setNavigatorOpen(true);
  }

  function openChapterNavigator() {
    setNavigatorBook(book);
    setNavigatorOpen(true);
  }

  function handleNavigatorOpenChange(nextOpen: boolean) {
    setNavigatorOpen(nextOpen);
    if (!nextOpen) {
      setNavigatorBook(null);
    }
  }

  return (
    <div
      className={cn(
        CHAPTER_CHROME_CONTAINER_CLASS,
        "flex w-full min-w-0 items-center gap-3 py-4 px-2 @max-2xl/chapter-chrome:gap-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 @max-xs/chapter-chrome:gap-1">
        <TooltipButton
          variant="ghost"
          size="icon"
          onClick={goPrev}
          disabled={!hasPrev}
          className="h-8 w-8 shrink-0"
          tooltip="Previous chapter"
          aria-label="Previous chapter"
        >
          <ChevronLeft className="h-4 w-4" />
        </TooltipButton>
        <h1 className={REFERENCE_WELL_CLASS}>
          <TooltipButton
            variant="ghost"
            onClick={openBookNavigator}
            className={cn(
              REFERENCE_SEGMENT_CLASS,
              // Button's base `shrink-0` would ignore `min-w-0` and overflow
              // the chapter number. `shrink` lets the name ellipsize.
              "min-w-0 shrink overflow-hidden",
            )}
            tooltip={`${displayBookName(book)} · Change book (${passageShortcutLabel})`}
            aria-label={`Change book, currently ${displayBookName(book)}`}
          >
            <span className="min-w-0 truncate" title={displayBookName(book)}>
              {displayBookName(book)}
            </span>
            <ReferenceCaret />
          </TooltipButton>
          <TooltipButton
            variant="ghost"
            onClick={openChapterNavigator}
            className={cn(
              REFERENCE_SEGMENT_CLASS,
              "shrink-0 tabular-nums @max-xs/chapter-chrome:px-1",
            )}
            tooltip={`Change chapter in ${book}`}
            aria-label={`Change chapter in ${book}, currently chapter ${chapter}`}
          >
            {chapter}
            <ReferenceCaret />
          </TooltipButton>
          <PassageNavigator
            open={navigatorOpen}
            onOpenChange={handleNavigatorOpenChange}
            initialBookName={navigatorBook}
            trigger={null}
            onSelectPassage={(passageId, label) =>
              navigateActiveTab(passageId, label)
            }
          />
        </h1>
        <TooltipButton
          variant="ghost"
          size="icon"
          onClick={goNext}
          disabled={!hasNext}
          className="h-8 w-8 shrink-0"
          tooltip="Next chapter"
          aria-label="Next chapter"
        >
          <ChevronRight className="h-4 w-4" />
        </TooltipButton>
      </div>

      <HeaderShortcutToggle
        id="passage-section-headers"
        label="Headers"
        shortcut="H"
        checked={showSectionHeaders}
        onToggle={onToggleSectionHeaders}
        compactLabelClassName={CHAPTER_CHROME_COMPACT_LABEL_CLASS}
        tooltip={
          showSectionHeaders
            ? "Hide editorial section headings"
            : "Show editorial section headings"
        }
        className={cn(
          showSectionHeaders
            ? "border-border bg-muted/40 text-foreground"
            : "border-border bg-background",
          CHAPTER_CHROME_TIGHT_HIDE_CLASS,
        )}
        labelClassName={
          showSectionHeaders ? "text-foreground" : "text-muted-foreground"
        }
      />

      {onChapterNotesClick ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onChapterNotesClick}
              data-note-trigger
              aria-expanded={chapterNotesOpen}
              aria-label={
                chapterNotesOpen
                  ? `Close chapter notes for ${chapterLabel}`
                  : hasChapterNotes
                    ? `Open chapter notes for ${chapterLabel}`
                    : `Add a chapter note for ${chapterLabel}`
              }
              className={cn(
                // Match the chapter reference well: carved inset, no dashed outline.
                "ml-auto inline-flex max-w-[min(100%,18rem)] shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left cl-well transition-colors",
                CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS,
                chapterNoteSurfaceClass,
                chapterNotesOpen
                  ? "brightness-[0.97] ring-1 ring-[oklch(0.72_0.06_200)/40] dark:brightness-110"
                  : "hover:brightness-[0.98] dark:hover:brightness-110",
              )}
            >
              <ScrollText
                className={cn("h-4 w-4 shrink-0", chapterNoteInkClass)}
              />
              <span
                className={cn("min-w-0", CHAPTER_CHROME_COMPACT_HIDE_CLASS)}
              >
                <span
                  className={cn(
                    "block text-[10px] font-semibold uppercase tracking-wide",
                    chapterNoteInkClass,
                  )}
                >
                  Chapter
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={chapterNotesSubtitle}
                    variants={CHAPTER_HEADER_CTA_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={CHAPTER_CHROME_TRANSITION}
                    className="block truncate text-sm text-muted-foreground"
                  >
                    {chapterNotesSubtitle}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{chapterNotesTooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <div className="ml-auto" aria-hidden />
      )}
    </div>
  );
}
