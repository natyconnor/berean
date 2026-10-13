import {
  estimateMasteryDays,
  formatMasteryDuration,
  nextStepCopy,
  type NextStepSchedule,
} from "./memorize-plan";
import { formatNextReviewDay } from "./memory-today";
import {
  isLearningLocked,
  isReviewPhase,
  type MemoryStatus,
} from "./memory-scheduler";

/**
 * What an empty Memory screen says, so it always ends with a next step:
 * when the next review is, what unlocks next, or what to start.
 */

export interface EmptyStateCopy {
  title: string;
  body: string | null;
}

export interface ScheduledVerse {
  status: MemoryStatus;
  learnStage: number;
  dueAt: number;
  lastReviewedAt?: number;
}

/** When the soonest memorized verse comes back after `now`, or `null`. */
export function soonestReviewAt(
  verses: readonly ScheduledVerse[],
  now: number,
): number | null {
  let soonest: number | null = null;
  for (const verse of verses) {
    if (!isReviewPhase(verse.status) || verse.dueAt <= now) continue;
    if (soonest === null || verse.dueAt < soonest) soonest = verse.dueAt;
  }
  return soonest;
}

/** The learning verse whose next step opens soonest, or `null`. */
export function soonestLearningUnlock(
  verses: readonly ScheduledVerse[],
  now: number,
): ScheduledVerse | null {
  let soonest: ScheduledVerse | null = null;
  for (const verse of verses) {
    if (!isLearningLocked(verse, now)) continue;
    if (soonest === null || verse.dueAt < soonest.dueAt) soonest = verse;
  }
  return soonest;
}

/** Review with nothing due: when the next review is, if there is one. */
export function reviewEmptyCopy(
  nextReviewAt: number | null,
  now: number,
  timeZone?: string,
): EmptyStateCopy {
  const day = formatNextReviewDay(nextReviewAt, now, timeZone);
  if (day === null) return { title: "Nothing to review yet", body: null };
  return { title: "All caught up", body: `Your next review is ${day}.` };
}

export interface LearnEmptyCopy extends EmptyStateCopy {
  body: string;
  /** Nothing is waiting to unlock, so offer something new. */
  startSomethingNew: boolean;
}

/** Learn with nothing open: what unlocks next, else start something new. */
export function learnEmptyCopy(
  unlock: NextStepSchedule | null,
  now: number,
  timeZone?: string,
): LearnEmptyCopy {
  return unlock
    ? {
        title: "Nothing new today",
        body: nextStepCopy(unlock, now, timeZone),
        startSomethingNew: false,
      }
    : {
        title: "Nothing new today",
        body: "Pick something new to memorize.",
        startSomethingNew: true,
      };
}

/** Practice before anything is memorized; `scopeLabel` names one verse. */
export function practiceEmptyCopy(scopeLabel?: string): EmptyStateCopy {
  return {
    title: "Nothing to practice yet",
    body: scopeLabel
      ? `Practice opens once ${scopeLabel} is memorized.`
      : "Practice opens once you've memorized your first verse.",
  };
}

export type LibraryView = "due" | "learning" | "memorized" | "mastered" | "all";

/** One line for an empty Library filter. */
export function libraryEmptyCopy(view: LibraryView): string {
  switch (view) {
    case "due":
      return "Nothing due today.";
    case "learning":
      return "Nothing in progress. Memorize a verse to start.";
    case "memorized":
      return "Verses show up here once they finish learning.";
    case "mastered":
      // The same one-verse estimate as the Memorize sheet's mastery line.
      return `Nothing mastered yet. Mastery comes after ${formatMasteryDuration(
        estimateMasteryDays({ mode: "verse", verseCount: 1 }),
        { short: true },
      )} of short reviews.`;
    case "all":
      return "Memorize a verse to see it here.";
  }
}
