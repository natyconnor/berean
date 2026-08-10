import { GraduationCap, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isLearningLocked,
  isLearningPhase,
  type MemoryStatus,
} from "@/lib/memory-scheduler";

import type { PracticeVerse } from "./practice/practice-board";

/**
 * Inline Learn / Review control for hearted-verse list rows so practice does
 * not require opening the detail dialog first.
 *
 * Soft-locked learning verses show a disabled "Tomorrow" CTA — today's session
 * is done; the verse stays visible but cannot advance until due again.
 */
export function MemoryVerseListAction({
  status,
  verse,
  now,
  onLearn,
  onReview,
}: {
  status: MemoryStatus;
  verse: PracticeVerse;
  now: number;
  onLearn: (verse: PracticeVerse) => void;
  onReview: (verse: PracticeVerse) => void;
}) {
  if (isLearningPhase(status)) {
    const locked = isLearningLocked({ status, dueAt: verse.dueAt ?? now }, now);
    if (locked) {
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2.5"
          disabled
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          Tomorrow
        </Button>
      );
    }
    const label = status === "learning" ? "Continue Learning" : "Learn";
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2.5"
        onClick={() => onLearn(verse)}
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
