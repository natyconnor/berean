import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTabs } from "@/lib/use-tabs";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";

interface ChapterPagerProps {
  book: string;
  chapter: number;
}

export function ChapterPager({ book, chapter }: ChapterPagerProps) {
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);

  if (!previous && !next) return null;

  return (
    <div className="flex items-center justify-between py-6 border-t">
      {previous ? (
        <button
          onClick={() => navigateActiveTab(previous.passageId, previous.label)}
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{previous.label}</span>
        </button>
      ) : (
        <div />
      )}
      {next ? (
        <button
          onClick={() => navigateActiveTab(next.passageId, next.label)}
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <span>{next.label}</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}
