import { stepLadderDay } from "./memory-copy";
import { goalLearnDaysLeft, type GoalCard } from "./memory-goals";
import {
  calendarDaysBetween,
  estimateReviewDaysToMastery,
  formatDueDay,
  formatLearnDuration,
  formatMasteryDuration,
  formatShortDate,
  projectedFinishDate,
  type MemorizeMode,
} from "./memorize-plan";
import { isReviewPhase } from "./memory-scheduler";

/**
 * One row of "Learning and mastery by goal" in Your progress: the two tracks
 * side by side (never merged into one number) and when it is next due.
 */
export interface GoalProgressRow {
  kindLabel: "Passage" | "Pack" | "Verse";
  learnedLabel: string;
  learnedFraction: number;
  masteryLabel: string;
  masteryFraction: number;
  /** "Today", "5 reviews today", "Tomorrow", "Thu", "Oct 20"; `null` when nothing is scheduled. */
  nextLabel: string | null;
  nextIsToday: boolean;
}

/** "On track for {date}" assumes a daily session; after this many idle days it reads "to go". */
const ON_TRACK_IDLE_DAYS = 2;

function percent(fraction: number): number {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function masteryAfterLearningLabel(): string {
  return `${formatMasteryDuration(estimateReviewDaysToMastery(), { short: true })} after learning`;
}

function learnedLabel(
  goal: GoalCard,
  mode: MemorizeMode,
  learned: number,
  total: number,
  now: number,
  timeZone: string | undefined,
): string {
  if (total > 0 && learned >= total) return `${learned} of ${total} learned`;
  const days = goalLearnDaysLeft(goal);
  if (goal.lastPracticedAt === null) {
    return `${learned} of ${total} · ${formatLearnDuration(days).toLowerCase()}`;
  }
  if (
    calendarDaysBetween(goal.lastPracticedAt, now, timeZone) >=
    ON_TRACK_IDLE_DAYS
  ) {
    return `${learned} of ${total} learned · ${formatLearnDuration(days, { short: true })} to go`;
  }
  const finish = projectedFinishDate(
    { mode, verseCount: total, learnedCount: learned },
    now,
  );
  return `${learned} of ${total} learned · on track for ${formatShortDate(finish, timeZone)}`;
}

function nextDue(
  nextDueAt: number | null,
  now: number,
  timeZone: string | undefined,
): Pick<GoalProgressRow, "nextLabel" | "nextIsToday"> {
  if (nextDueAt === null) return { nextLabel: null, nextIsToday: false };
  const day = formatDueDay(nextDueAt, now, timeZone);
  return { nextLabel: capitalize(day), nextIsToday: day === "today" };
}

const TODAY_NEXT = { nextLabel: "Today", nextIsToday: true } as const;

export function goalProgressRow(
  goal: GoalCard,
  now: number,
  timeZone?: string,
): GoalProgressRow {
  switch (goal.kind) {
    case "passage": {
      const building = goal.status === "building";
      return {
        kindLabel: "Passage",
        learnedLabel: learnedLabel(
          goal,
          "passage",
          goal.learnedVerses,
          goal.verseCount,
          now,
          timeZone,
        ),
        learnedFraction:
          goal.verseCount === 0 ? 0 : goal.learnedVerses / goal.verseCount,
        masteryLabel: building
          ? masteryAfterLearningLabel()
          : goal.status === "mastered"
            ? "Mastered"
            : `Mastery ${percent(goal.masteryFraction)}%`,
        masteryFraction: goal.masteryFraction,
        ...(goal.hasWorkToday
          ? TODAY_NEXT
          : nextDue(goal.nextDueAt, now, timeZone)),
      };
    }
    case "pack": {
      const reviews = goal.reviewsDue.length;
      return {
        kindLabel: "Pack",
        learnedLabel: learnedLabel(
          goal,
          "pack",
          goal.learned,
          goal.verseCount,
          now,
          timeZone,
        ),
        learnedFraction:
          goal.verseCount === 0 ? 0 : goal.learned / goal.verseCount,
        masteryLabel:
          goal.learned === 0
            ? masteryAfterLearningLabel()
            : `${goal.mastered} of ${goal.verseCount} mastered · ${percent(goal.masteryFraction)}% of the way`,
        masteryFraction: goal.masteryFraction,
        ...(reviews > 0
          ? {
              nextLabel: `${reviews} ${reviews === 1 ? "review" : "reviews"} today`,
              nextIsToday: true,
            }
          : goal.learningToday > 0
            ? TODAY_NEXT
            : nextDue(goal.nextDueAt, now, timeZone)),
      };
    }
    case "verse": {
      const learnedPhase = isReviewPhase(goal.status);
      const ladderDay = stepLadderDay(goal.learnStage);
      return {
        kindLabel: "Verse",
        learnedLabel: learnedPhase
          ? "Learned"
          : goal.status === "new"
            ? "Up next"
            : `Day ${ladderDay} of 3`,
        learnedFraction: learnedPhase
          ? 1
          : goal.status === "new"
            ? 0
            : (ladderDay - 1) / 3,
        masteryLabel: !learnedPhase
          ? masteryAfterLearningLabel()
          : goal.status === "mastered"
            ? "Mastered"
            : `Mastery ${percent(goal.masteryFraction)}%`,
        masteryFraction: goal.masteryFraction,
        ...(goal.hasWorkToday
          ? TODAY_NEXT
          : nextDue(goal.nextDueAt, now, timeZone)),
      };
    }
  }
}
