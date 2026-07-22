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
import { PassageNavigator } from "./passage-navigator";
import { cn } from "@/lib/utils";

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

  function goPrev() {
    if (!previous) return;
    navigateActiveTab(previous.passageId, previous.label);
  }

  function goNext() {
    if (!next) return;
    navigateActiveTab(next.passageId, next.label);
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
        <h1 className="text-2xl font-serif font-semibold tracking-tight">
          <PassageNavigator
            onSelectPassage={(passageId, label) =>
              navigateActiveTab(passageId, label)
            }
            trigger={
              <TooltipButton
                variant="ghost"
                className="h-auto gap-1 rounded-md px-2 py-1 text-2xl font-serif font-semibold tracking-tight"
                tooltip="Click to navigate to a specific Bible chapter"
                aria-label="Navigate to a specific Bible chapter"
              >
                <span>
                  {book} {chapter}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </TooltipButton>
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
            ? "Hide ESV section headings"
            : "Show ESV section headings"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
