import { TooltipButton } from "@/components/ui/tooltip-button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTabs } from "@/lib/use-tabs";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";

interface ChapterHeaderProps {
  book: string;
  chapter: number;
}

export function ChapterHeader({ book, chapter }: ChapterHeaderProps) {
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
    <div className="flex items-center justify-between py-4 px-2">
      <TooltipButton
        variant="ghost"
        size="icon"
        onClick={goPrev}
        disabled={!hasPrev}
        className="h-8 w-8"
        tooltip="Previous chapter"
      >
        <ChevronLeft className="h-4 w-4" />
      </TooltipButton>
      <h1 className="text-2xl font-serif font-semibold tracking-tight">
        {book} {chapter}
      </h1>
      <TooltipButton
        variant="ghost"
        size="icon"
        onClick={goNext}
        disabled={!hasNext}
        className="h-8 w-8"
        tooltip="Next chapter"
      >
        <ChevronRight className="h-4 w-4" />
      </TooltipButton>
    </div>
  );
}
