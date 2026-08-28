import type { MemoryStatus } from "@/lib/memory-scheduler";

import type { Id } from "../../../convex/_generated/dataModel";
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
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
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
    ease: row.ease,
    intervalDays: row.intervalDays,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    earlyReviewApplied: row.earlyReviewApplied,
  };
}

export type DueQueuePackEntry = {
  kind: "pack";
  packId: Id<"packs">;
  packName: string;
  dueAt: number;
  status: MemoryStatus;
  learnStage: number;
  stageReps?: number;
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
  lastReviewedAt?: number;
  members: CardReference[];
};

export type DueQueueVerseEntry = {
  kind?: "verse";
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  learnStage: number;
  stageReps?: number;
  status: MemoryStatus;
  dueAt: number;
  lastReviewedAt?: number;
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
};

/** Map a global due-queue row (verse or unified pack card) for Practice. */
export function dueQueueEntryToPracticeVerse(
  entry: DueQueueVerseEntry | DueQueuePackEntry,
): PracticeVerse {
  if (entry.kind === "pack") {
    const lead = entry.members[0];
    if (!lead) {
      throw new Error("Unified pack queue item is missing members");
    }
    return {
      reference: lead,
      learnStage: entry.learnStage,
      stageReps: entry.stageReps,
      status: entry.status,
      dueAt: entry.dueAt,
      lastReviewedAt: entry.lastReviewedAt,
      ease: entry.ease,
      intervalDays: entry.intervalDays,
      consecutiveCorrect: entry.consecutiveCorrect,
      lapses: entry.lapses,
      earlyReviewApplied: entry.earlyReviewApplied,
      composite: {
        packId: entry.packId,
        packName: entry.packName,
        members: entry.members,
      },
    };
  }
  return toPracticeVerse(entry);
}
