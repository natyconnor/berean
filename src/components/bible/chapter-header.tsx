import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOptionalTutorial } from "@/components/tutorial/tutorial-context";
import {
  useFeatureHint,
  useMarkHintShownWhenPending,
} from "@/components/tutorial/use-feature-hint";
import {
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { displayBookName, getBookInfo } from "@/lib/bible-books";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import {
  chapterMemorizeCopy,
  chapterMemorizeMark,
  type ChapterMemorizeMark,
  type ChapterMemorizeState,
} from "@/lib/chapter-memorize";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import { formatBookChapter } from "@/lib/verse-ref-utils";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";
import {
  chapterNoteInkClass,
  chapterNoteSurfaceClass,
} from "@/components/passage/chapter-note-styles";
import {
  CHAPTER_CHROME_COMPACT_LABEL_CLASS,
  CHAPTER_CHROME_CONTAINER_CLASS,
  CHAPTER_CHROME_TIGHT_HIDE_CLASS,
} from "@/components/passage/header-chrome";
import { HeaderShortcutToggle } from "@/components/passage/header-shortcut-toggle";
import { PassageNavigator } from "./passage-navigator";

const CHAPTER_CHROME_ICON_BUTTON_CLASS =
  "size-8 shrink-0 justify-center gap-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

export interface ChapterMemorizeControl {
  state: ChapterMemorizeState;
  /** Opens the Memorize sheet for the chapter; `opener` gets focus back. */
  onMemorize: (opener: HTMLElement) => void;
  /** Opens the pack of the passage this chapter belongs to. */
  onOpenPack: (packId: string) => void;
}

const CHAPTER_MEMORIZE_NEW_COPY =
  "New: memorize this chapter in a few minutes a day.";

/** The ring or check on the bare Memorize icon. */
function ChapterMemorizeMarkIcon({ mark }: { mark: ChapterMemorizeMark }) {
  if (mark.kind === "none") return null;
  if (mark.kind === "done") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 14 14"
        data-memorize-mark="done"
        className="pointer-events-none absolute -top-1 -right-1 size-3.5"
      >
        <circle
          cx="7"
          cy="7"
          r="6"
          strokeWidth="2"
          className="fill-primary stroke-background"
        />
        <path
          d="M4.5 7.25 6.25 9 9.5 5.5"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary-foreground"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      data-memorize-mark="progress"
      className="pointer-events-none absolute inset-0 m-auto size-6"
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth="1.5"
      />
      {mark.fraction > 0 ? (
        <circle
          cx="12"
          cy="12"
          r="10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${mark.fraction * 100} 100`}
          transform="rotate(-90 12 12)"
        />
      ) : null}
    </svg>
  );
}

function ChapterMemorizeButton({
  control,
}: {
  control: ChapterMemorizeControl;
}) {
  const { state, onMemorize, onOpenPack } = control;
  const copy = chapterMemorizeCopy(state);
  // People who finished the app tour before it taught Memorize.
  const tutorial = useOptionalTutorial();
  const newHint = useFeatureHint(
    FEATURE_HINTS.CHAPTER_MEMORIZE_NEW,
    state.kind === "memorize" &&
      tutorial?.isMainTutorialComplete === true &&
      tutorial.activeTour === null,
  );
  useMarkHintShownWhenPending(newHint);

  return (
    <Popover
      open={newHint.pending}
      onOpenChange={(open) => {
        if (!open) newHint.dismiss();
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverAnchor asChild>
            <button
              type="button"
              data-tour-id="chapter-memorize"
              aria-label={copy.label}
              onClick={(event) => {
                if (state.kind === "memorize") {
                  onMemorize(event.currentTarget);
                } else {
                  onOpenPack(state.packId);
                }
              }}
              className={cn(
                "relative inline-flex items-center overflow-visible rounded-lg border border-primary/35 bg-primary/7 text-primary transition-colors hover:bg-primary/12 dark:bg-primary/10 dark:hover:bg-primary/15",
                CHAPTER_CHROME_ICON_BUTTON_CLASS,
                CHAPTER_CHROME_TIGHT_HIDE_CLASS,
              )}
            >
              <Brain aria-hidden className="size-4 shrink-0" />
              <ChapterMemorizeMarkIcon mark={chapterMemorizeMark(state)} />
            </button>
          </PopoverAnchor>
        </TooltipTrigger>
        <TooltipContent>{copy.tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={8}
        hideWhenDetached
        data-passage-dismiss-exempt
        aria-label={CHAPTER_MEMORIZE_NEW_COPY}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-60 space-y-2 border-primary/30 p-3"
      >
        <p className="text-[13px] leading-snug">{CHAPTER_MEMORIZE_NEW_COPY}</p>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => newHint.dismiss()}
          >
            Got it
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
  /** Memorize button beside the chapter-note well; absent hides it. */
  memorize?: ChapterMemorizeControl | null;
}

export function ChapterHeader({
  book,
  chapter,
  showSectionHeaders,
  onToggleSectionHeaders,
  chapterScopedNoteCount = 0,
  chapterNotesOpen = false,
  onChapterNotesClick,
  memorize = null,
}: ChapterHeaderProps) {
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);
  const hasPrev = previous !== null;
  const hasNext = next !== null;
  const passageShortcutLabel = formatCommandOrControlShortcut("G");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorBook, setNavigatorBook] = useState<string | null>(null);

  const hasChapterPicker = getBookInfo(book)?.chapters !== 1;
  const chapterLabel = formatBookChapter(book, chapter);
  const previousChapterName = previous
    ? `Previous chapter (${previous.label})`
    : "Previous chapter";
  const nextChapterName = next
    ? `Next chapter (${next.label})`
    : "Next chapter";
  const hasChapterNotes = chapterScopedNoteCount > 0;
  const chapterNotesAction = chapterNotesOpen
    ? "Close chapter notes"
    : hasChapterNotes
      ? "Open chapter notes"
      : "Add a chapter note";
  const chapterNotesTooltip = hasChapterNotes
    ? `${chapterNotesAction} · ${chapterScopedNoteCount}`
    : chapterNotesAction;
  const chapterNotesBadge =
    chapterScopedNoteCount > 9 ? "9+" : String(chapterScopedNoteCount);

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
        "flex w-full min-w-0 items-center gap-2 overflow-visible py-4 px-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 @max-xs/chapter-chrome:gap-1">
        <TooltipButton
          variant="ghost"
          size="icon"
          onClick={goPrev}
          disabled={!hasPrev}
          className="h-8 w-8 shrink-0"
          tooltip={previousChapterName}
          aria-label={previousChapterName}
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
          {hasChapterPicker ? (
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
          ) : null}
          <PassageNavigator
            open={navigatorOpen}
            onOpenChange={handleNavigatorOpenChange}
            initialBookName={navigatorBook}
            trigger={null}
            onSelectPassage={(passageId, label, search) =>
              navigateActiveTab(passageId, label, search)
            }
          />
        </h1>
        <TooltipButton
          variant="ghost"
          size="icon"
          onClick={goNext}
          disabled={!hasNext}
          className="h-8 w-8 shrink-0"
          tooltip={nextChapterName}
          aria-label={nextChapterName}
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
          "ml-auto",
          CHAPTER_CHROME_TIGHT_HIDE_CLASS,
        )}
        labelClassName={
          showSectionHeaders ? "text-foreground" : "text-muted-foreground"
        }
      />

      {memorize ? <ChapterMemorizeButton control={memorize} /> : null}

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
                "relative inline-flex items-center overflow-visible rounded-lg text-left cl-well transition-colors",
                CHAPTER_CHROME_ICON_BUTTON_CLASS,
                "@max-xs/chapter-chrome:ml-auto",
                chapterNoteSurfaceClass,
                chapterNotesOpen
                  ? "brightness-[0.97] ring-1 ring-[oklch(0.72_0.06_200)/40] dark:brightness-110"
                  : "hover:brightness-[0.98] dark:hover:brightness-110",
              )}
            >
              <ScrollText
                className={cn("size-4 shrink-0", chapterNoteInkClass)}
              />
              {hasChapterNotes ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[oklch(0.42_0.07_200)] px-1 text-[10px] font-semibold tabular-nums text-[oklch(0.985_0.012_200)] ring-2 ring-background dark:bg-[oklch(0.78_0.07_200)] dark:text-[oklch(0.20_0.03_200)]"
                >
                  {chapterNotesBadge}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent>{chapterNotesTooltip}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
