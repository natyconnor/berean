import type { MemoryStatus } from "@/lib/memory-scheduler";

import type { CardReference } from "../study/study-card-model";
import type { PracticeVerse } from "./practice/practice-board";

/** Map a library / pack row into the Practice board's verse shape. */
export function toPracticeVerse(row: {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  learnStage: number;
  stageReps?: number;
  status: MemoryStatus;
  dueAt?: number;
  lastReviewedAt?: number;
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
    dueAt: row.dueAt,
    lastReviewedAt: row.lastReviewedAt,
  };
}
