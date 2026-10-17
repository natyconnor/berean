import { Dumbbell, GraduationCap, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EXTRA_PRACTICE_TOOLTIP, learnActionLabel } from "@/lib/memory-copy";
import { libraryRowAction } from "@/lib/memory-library-row";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

import type { PracticeVerse } from "./practice/practice-board";

const ROW_BUTTON_CLASS = "shrink-0 max-sm:h-11 max-sm:px-3";

/**
 * A Library row's one quiet session control so a specific verse can be
 * picked without opening its detail: an outline Learn or Review, or a ghost
 * Practice on memorized verses. A verse whose step for today is done shows
 * nothing; its status line says when it opens.
 */
export function MemoryVerseListAction({
  status,
  verse,
  now,
  onLearn,
  onReview,
  onPractice,
}: {
  status: MemoryStatus;
  verse: PracticeVerse;
  now: number;
  onLearn: (verse: PracticeVerse) => void;
  onReview: (verse: PracticeVerse) => void;
  onPractice: (verse: PracticeVerse) => void;
}) {
  const action = libraryRowAction(
    {
      status,
      learnStage: verse.learnStage,
      dueAt: verse.dueAt ?? now,
      lastReviewedAt: verse.lastReviewedAt,
    },
    now,
  );
  if (action === null) return null;

  const reference = formatVerseRefTitle(verse.reference);

  if (action === "practice") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(ROW_BUTTON_CLASS, "text-muted-foreground")}
            aria-label={`Practice ${reference}`}
            onClick={() => onPractice(verse)}
          >
            <Dumbbell aria-hidden />
            Practice
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {EXTRA_PRACTICE_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    );
  }

  const isReview = action === "review";
  const label = isReview ? "Review" : learnActionLabel(verse);
  const Icon = isReview ? RotateCcw : GraduationCap;
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={ROW_BUTTON_CLASS}
      aria-label={`${label} ${reference}`}
      onClick={() => (isReview ? onReview(verse) : onLearn(verse))}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}
