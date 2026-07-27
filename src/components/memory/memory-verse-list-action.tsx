import { GraduationCap, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isLearningPhase, type MemoryStatus } from "@/lib/memory-scheduler";

import type { PracticeVerse } from "./practice/practice-board";

/**
 * Inline Learn / Review control for hearted-verse list rows so practice does
 * not require opening the detail dialog first.
 */
export function MemoryVerseListAction({
  status,
  verse,
  onPractice,
  onReview,
}: {
  status: MemoryStatus;
  verse: PracticeVerse;
  onPractice: (verse: PracticeVerse) => void;
  onReview: (verse: PracticeVerse) => void;
}) {
  if (isLearningPhase(status)) {
    const label = status === "learning" ? "Continue Learning" : "Learn";
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2.5"
        onClick={() => onPractice(verse)}
      >
        <GraduationCap className="h-3.5 w-3.5" aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      className="h-7 shrink-0 gap-1 px-2.5"
      onClick={() => onReview(verse)}
    >
      <Play className="h-3.5 w-3.5" aria-hidden />
      Review
    </Button>
  );
}
