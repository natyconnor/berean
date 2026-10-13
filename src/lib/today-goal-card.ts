import {
  TODAY_LABEL,
  stepAction,
  stepLadderDay,
  todayStepParts,
} from "./memory-copy";
import {
  goalLearnPace,
  type GoalCard,
  type PackGoalCard,
  type PassageGoalCard,
  type VerseGoalCard,
} from "./memory-goals";
import { withReturn } from "./memory-return";
import { isReviewPhase } from "./memory-scheduler";
import {
  memoryPackSessionHref,
  memoryTodaySessionHref,
  memoryVerseSessionHref,
} from "./memory-session-path";
import { formatNextReviewDay } from "./memory-today";
import {
  calendarDaysBetween,
  estimateSessionMinutes,
  formatDueDay,
} from "./memorize-plan";
import {
  packDetailActions,
  packDetailProgress,
  passageDetailActions,
  type PackDetailSession,
} from "./pack-detail-model";

/**
 * One goal card on Today: its chip, today's step (or what is done), the bars
 * for its phase, and its one action. Learned and Mastery stay separate bars.
 * Pure; `now` is passed in.
 */

/** Today shows at most this many goal cards; Your verses has the rest. */
export const GOAL_CARD_LIMIT = 6;

/** Sessions started from Today come back to Today. */
export const TODAY_RETURN = "/memory";

/** Pack reviews show as chips: all of them up to this many, else one fewer plus "+N more". */
const REVIEW_CHIP_LIMIT = 6;

export type GoalChip =
  { tone: "today"; label: string } | { tone: "done"; label: string };

export type GoalStep =
  /** "Today:" "read verses 5–6, then type them with first letters." */
  | { kind: "learn"; lead: string; rest: string }
  | { kind: "learnCount"; text: string }
  | { kind: "review"; text: string }
  | { kind: "reviews"; labels: string[]; more: number }
  | { kind: "done"; text: string }
  | { kind: "note"; text: string };

export interface GoalBar {
  track: "learned" | "mastery";
  label: string;
  detail: string | null;
  fraction: number;
  /** Spelled out for screen readers, e.g. "Learned 5 of 11 verses". */
  ariaLabel: string;
}

export interface GoalAction {
  kind: "learn" | "review";
  label: string;
  href: string;
}

export interface TodayGoalCardModel {
  /** "Passage · 11 verses" */
  kindLabel: string;
  chip: GoalChip | null;
  steps: GoalStep[];
  bars: GoalBar[];
  action: GoalAction | null;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function percent(fraction: number): number {
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
}

function practicedToday(
  goal: GoalCard,
  now: number,
  timeZone: string | undefined,
): boolean {
  return (
    goal.lastPracticedAt !== null &&
    calendarDaysBetween(goal.lastPracticedAt, now, timeZone) <= 0
  );
}

function hasStarted(goal: GoalCard): boolean {
  if (goal.lastPracticedAt !== null) return true;
  switch (goal.kind) {
    case "passage":
      return goal.learnedVerses > 0;
    case "pack":
      return goal.learned + goal.learning > 0;
    case "verse":
      return goal.learnStage > 0;
  }
}

function nextWhen(
  goal: GoalCard,
  now: number,
  timeZone: string | undefined,
): string | null {
  return formatNextReviewDay(goal.nextDueAt, now, timeZone);
}

function chipFor(goal: GoalCard, doneToday: boolean): GoalChip | null {
  if (goal.hasWorkToday) {
    if (goal.kind === "pack" && goal.learningToday === 0) {
      return {
        tone: "today",
        label: `${plural(goal.reviewsDue.length, "review")} today`,
      };
    }
    return {
      tone: "today",
      label: hasStarted(goal) ? TODAY_LABEL : "Starts today",
    };
  }
  return doneToday ? { tone: "done", label: "Done today" } : null;
}

function sessionHref(packId: string, session: PackDetailSession): string {
  return withReturn(
    session === "today"
      ? memoryTodaySessionHref({ packId })
      : memoryPackSessionHref(session, packId),
    TODAY_RETURN,
  );
}

function startOrContinue(goal: GoalCard, minutes: number): string {
  return `${hasStarted(goal) ? "Continue" : "Start"} · ${minutes} min`;
}

function passageModel(
  goal: PassageGoalCard,
  now: number,
  timeZone: string | undefined,
  doneToday: boolean,
): Omit<TodayGoalCardModel, "kindLabel" | "chip"> {
  const building = goal.status === "building";
  const when = nextWhen(goal, now, timeZone);

  const steps: GoalStep[] = [];
  if (goal.hasWorkToday) {
    if (!building) {
      steps.push({ kind: "review", text: "Recite it all the way through." });
    } else if (goal.todayStep) {
      steps.push({ kind: "learn", ...todayStepParts(goal.todayStep.label) });
    } else {
      steps.push({ kind: "learnCount", text: "Today's session is ready." });
    }
  } else if (building) {
    const next = when ? `Next step ${when}.` : null;
    if (doneToday) {
      steps.push({
        kind: "done",
        text: next ? `Today's step done. ${next}` : "Today's step done.",
      });
    } else if (next) {
      steps.push({ kind: "note", text: next });
    }
  } else if (doneToday) {
    steps.push({ kind: "done", text: "Reviewed today." });
  }

  let bars: GoalBar[];
  if (building) {
    bars = [
      {
        track: "learned",
        label: `${goal.learnedVerses} of ${plural(goal.verseCount, "verse")} learned`,
        detail: goalLearnPace(goal, now, timeZone),
        fraction:
          goal.verseCount === 0 ? 0 : goal.learnedVerses / goal.verseCount,
        ariaLabel: `Learned ${goal.learnedVerses} of ${plural(goal.verseCount, "verse")}`,
      },
    ];
  } else {
    const recite = goal.hasWorkToday
      ? "review today"
      : goal.nextDueAt === null
        ? null
        : `next review ${formatDueDay(goal.nextDueAt, now, timeZone)}`;
    bars = [
      goal.status === "mastered"
        ? {
            track: "mastery",
            label: "Mastered",
            detail: recite,
            fraction: 1,
            ariaLabel: "Mastered",
          }
        : {
            track: "mastery",
            label: `Mastery ${percent(goal.masteryFraction)}%`,
            detail: recite,
            fraction: goal.masteryFraction,
            ariaLabel: `Mastery ${percent(goal.masteryFraction)} percent`,
          },
    ];
  }

  let action: GoalAction | null = null;
  const main = goal.hasWorkToday
    ? passageDetailActions(goal, now, timeZone).main
    : null;
  if (main?.kind === "session") {
    action = building
      ? {
          kind: "learn",
          label: startOrContinue(
            goal,
            estimateSessionMinutes({
              learningVerses: 0,
              reviewVerses: 0,
              passageSessions: 1,
            }),
          ),
          href: sessionHref(goal.packId, main.session),
        }
      : {
          kind: "review",
          label: "Review",
          href: sessionHref(goal.packId, main.session),
        };
  }

  return { steps, bars, action };
}

function packModel(
  goal: PackGoalCard,
  now: number,
  timeZone: string | undefined,
  doneToday: boolean,
): Omit<TodayGoalCardModel, "kindLabel" | "chip"> {
  const reviews = goal.reviewsDue.length;
  const steps: GoalStep[] = [];
  if (goal.hasWorkToday) {
    if (goal.learningToday > 0) {
      steps.push({
        kind: "learnCount",
        text: `${plural(goal.learningToday, "verse")} to learn today`,
      });
    }
    if (reviews > 0) {
      const shown =
        reviews > REVIEW_CHIP_LIMIT ? REVIEW_CHIP_LIMIT - 1 : reviews;
      steps.push({
        kind: "reviews",
        labels: goal.reviewsDue.slice(0, shown).map((review) => review.label),
        more: reviews - shown,
      });
    }
  } else {
    const when = nextWhen(goal, now, timeZone);
    const next = when ? `Next up ${when}.` : null;
    if (doneToday) {
      steps.push({
        kind: "done",
        text: next ? `Done for today. ${next}` : "Done for today.",
      });
    } else if (next) {
      steps.push({ kind: "note", text: next });
    }
  }

  const progress = packDetailProgress(goal, now, timeZone);
  const bars: GoalBar[] = [];
  if (progress.learned) {
    bars.push({
      track: "learned",
      ...progress.learned,
      ariaLabel: `Learned ${goal.learned} of ${plural(goal.verseCount, "verse")}`,
    });
  }
  if (progress.mastery) {
    bars.push({
      track: "mastery",
      ...progress.mastery,
      ariaLabel: `Mastery ${percent(goal.masteryFraction)} percent`,
    });
  }

  let action: GoalAction | null = null;
  const main = goal.hasWorkToday
    ? packDetailActions(goal, [], now, timeZone).main
    : null;
  if (main?.kind === "session") {
    const minutes = estimateSessionMinutes({
      learningVerses: goal.learningToday,
      reviewVerses: reviews,
      passageSessions: 0,
    });
    action =
      goal.learningToday === 0
        ? {
            kind: "review",
            label: `Review ${reviews} · ${minutes} min`,
            href: sessionHref(goal.packId, main.session),
          }
        : {
            kind: "learn",
            label: startOrContinue(goal, minutes),
            href: sessionHref(goal.packId, main.session),
          };
  }

  return { steps, bars, action };
}

function verseModel(
  goal: VerseGoalCard,
  now: number,
  timeZone: string | undefined,
  doneToday: boolean,
): Omit<TodayGoalCardModel, "kindLabel" | "chip"> {
  const href = (kind: "learn" | "review") =>
    withReturn(memoryVerseSessionHref(kind, goal), TODAY_RETURN);

  if (isReviewPhase(goal.status)) {
    const label =
      goal.status === "mastered"
        ? "Mastered"
        : `Mastery ${percent(goal.masteryFraction)}%`;
    return {
      steps: goal.hasWorkToday
        ? [{ kind: "review", text: "Review due today." }]
        : doneToday
          ? [{ kind: "done", text: "Reviewed today." }]
          : [],
      bars: [
        {
          track: "mastery",
          label,
          detail: goal.hasWorkToday
            ? "review today"
            : goal.nextDueAt === null
              ? null
              : `next review ${formatDueDay(goal.nextDueAt, now, timeZone)}`,
          fraction: goal.status === "mastered" ? 1 : goal.masteryFraction,
          ariaLabel:
            goal.status === "mastered"
              ? "Mastered"
              : `Mastery ${percent(goal.masteryFraction)} percent`,
        },
      ],
      action: goal.hasWorkToday
        ? {
            kind: "review",
            label: `Review · ${estimateSessionMinutes({
              learningVerses: 0,
              reviewVerses: 1,
              passageSessions: 0,
            })} min`,
            href: href("review"),
          }
        : null,
    };
  }

  const day = stepLadderDay(goal.learnStage);
  const tomorrow = `Tomorrow: ${stepAction(goal.learnStage)}.`;
  let steps: GoalStep[];
  if (goal.hasWorkToday) {
    steps = [{ kind: "learn", ...todayStepParts(stepAction(goal.learnStage)) }];
  } else if (goal.status === "new") {
    steps = [{ kind: "note", text: "Up next. Starts when you're ready." }];
  } else {
    steps = [
      doneToday
        ? { kind: "done", text: `Today's step done. ${tomorrow}` }
        : { kind: "note", text: tomorrow },
    ];
  }

  return {
    steps,
    bars: [
      {
        track: "learned",
        label: "Learning",
        detail: goalLearnPace(goal, now, timeZone),
        fraction: (day - 1) / 3,
        ariaLabel: "Learning",
      },
    ],
    action: goal.hasWorkToday
      ? {
          kind: "learn",
          label: startOrContinue(
            goal,
            estimateSessionMinutes({
              learningVerses: 1,
              reviewVerses: 0,
              passageSessions: 0,
            }),
          ),
          href: href("learn"),
        }
      : null,
  };
}

function kindLabel(goal: GoalCard): string {
  switch (goal.kind) {
    case "passage":
      return `Passage · ${plural(goal.verseCount, "verse")}`;
    case "pack":
      return `Pack · ${plural(goal.verseCount, "verse")}`;
    case "verse":
      return "Verse";
  }
}

export function todayGoalCardModel(
  goal: GoalCard,
  now: number,
  timeZone?: string,
): TodayGoalCardModel {
  const doneToday = practicedToday(goal, now, timeZone);
  const body =
    goal.kind === "passage"
      ? passageModel(goal, now, timeZone, doneToday)
      : goal.kind === "pack"
        ? packModel(goal, now, timeZone, doneToday)
        : verseModel(goal, now, timeZone, doneToday);
  return {
    kindLabel: kindLabel(goal),
    chip: chipFor(goal, doneToday),
    ...body,
  };
}
