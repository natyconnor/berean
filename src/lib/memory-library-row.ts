import { nextStepCopy, type NextStepSchedule } from "./memorize-plan";
import {
  isDueForLibrary,
  isLearningLocked,
  isLearningPhase,
} from "./memory-scheduler";
import { reviewPhaseListAction } from "./memory-session";
import {
  todaySessionMinutes,
  todayWorkCount,
  type TodayCounts,
} from "./memory-today";

/**
 * One Your verses Library row: what happens next, whether it is due today,
 * and the one session it offers. Pure; the row holds the verse's schedule.
 */

export type LibraryRowAction = "learn" | "review" | "practice";

export interface LibraryRow {
  /** "Day 2 of 3: fill in the blanks", "Next review Thu". */
  line: string;
  /** A learning step or review is open today. */
  dueToday: boolean;
  /** `null` while today's step is done; the line says when it opens. */
  action: LibraryRowAction | null;
}

/** Learn (Up next or learning), Review when due, else Practice. */
export function libraryRowAction(
  schedule: NextStepSchedule,
  now: number,
): LibraryRowAction | null {
  if (isLearningPhase(schedule.status)) {
    return isLearningLocked(schedule, now) ? null : "learn";
  }
  return reviewPhaseListAction(schedule, now);
}

export function libraryRow(
  schedule: NextStepSchedule,
  now: number,
  timeZone?: string,
): LibraryRow {
  return {
    line: nextStepCopy(schedule, now, timeZone),
    dueToday: isDueForLibrary(schedule, now),
    action: libraryRowAction(schedule, now),
  };
}

/**
 * The Due today filter's one primary button: "Do all 5 · about 6 min", or
 * "Review all 3 · about 2 min" when only reviews are left. `null` when
 * nothing is left today.
 */
export function dueTodayBulkLabel(counts: TodayCounts): string | null {
  const work = todayWorkCount(counts);
  if (work === 0) return null;
  const onlyReviews = counts.learningVerses + counts.passageSessions === 0;
  return `${onlyReviews ? "Review" : "Do"} all ${work} · about ${todaySessionMinutes(counts)} min`;
}
