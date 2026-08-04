import { useState } from "react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTabs } from "@/lib/use-tabs";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import { PassageNavigator } from "./passage-navigator";
import { cn } from "@/lib/utils";

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
}

export function ChapterHeader({
  book,
  chapter,
  showSectionHeaders,
  onToggleSectionHeaders,
}: ChapterHeaderProps) {
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);
  const hasPrev = previous !== null;
  const hasNext = next !== null;
  const passageShortcutLabel = formatCommandOrControlShortcut("G");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorBook, setNavigatorBook] = useState<string | null>(null);

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
    <div className="flex items-center justify-between py-4 px-2 gap-4">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <TooltipButton
          variant="ghost"
          size="icon"
          onClick={goPrev}
          disabled={!hasPrev}
          className="h-8 w-8 shrink-0"
          tooltip="Previous chapter"
        >
          <ChevronLeft className="h-4 w-4" />
        </TooltipButton>
        <h1 className={REFERENCE_WELL_CLASS}>
          <TooltipButton
            variant="ghost"
            onClick={openBookNavigator}
            className={cn(REFERENCE_SEGMENT_CLASS, "min-w-0")}
            tooltip={`Change book (${passageShortcutLabel})`}
            aria-label={`Change book, currently ${book}`}
          >
            <span className="truncate">{book}</span>
            <ReferenceCaret />
          </TooltipButton>
          <TooltipButton
            variant="ghost"
            onClick={openChapterNavigator}
            className={cn(REFERENCE_SEGMENT_CLASS, "shrink-0 tabular-nums")}
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
        >
          <ChevronRight className="h-4 w-4" />
        </TooltipButton>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-md border px-2 py-1 transition-[background-color,border-color,color] duration-200",
              showSectionHeaders
                ? "border-border bg-muted/40 text-foreground"
                : "border-border bg-background",
            )}
          >
            <label
              htmlFor="passage-section-headers"
              className={cn(
                "flex cursor-pointer items-center gap-1.5 text-xs font-medium transition-colors",
                showSectionHeaders
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              Headers
              <kbd className="rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                H
              </kbd>
            </label>
            <Switch
              id="passage-section-headers"
              checked={showSectionHeaders}
              onCheckedChange={(checked) => {
                if (checked !== showSectionHeaders) {
                  onToggleSectionHeaders();
                }
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {showSectionHeaders
            ? "Hide editorial section headings"
            : "Show editorial section headings"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
