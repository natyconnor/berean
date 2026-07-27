import type { CardReference } from "@/components/study/study-card-model";
import type { MemoryStatus } from "@/lib/memory-scheduler";

import type { PracticeVerse } from "./practice/practice-board";

/** Build a practice/review payload from a library or pack member row. */
export function toPracticeVerse(row: {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  learnStage: number;
  stageReps?: number;
  status: MemoryStatus;
}): PracticeVerse {
  const reference: CardReference = {
    book: row.book,
    chapter: row.chapter,
    startVerse: row.startVerse,
    endVerse: row.endVerse,
  };
  return {
    reference,
    learnStage: row.learnStage,
    stageReps: row.stageReps,
    status: row.status,
  };
}
