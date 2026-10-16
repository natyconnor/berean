import type { VerseSpan } from "./hearted-verse-coverage";
import { stepAction, stepLadderDay, todayStepParts } from "./memory-copy";
import {
  goalLearnPace,
  type GoalCard,
  type PackGoalCard,
  type PassageGoalCard,
  type PassagePieceState,
  type VerseGoalCard,
} from "./memory-goals";
import { withReturn } from "./memory-return";
import { isReviewPhase, type MemoryStatus } from "./memory-scheduler";
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
import type { PassageDueStatus } from "./passage-due";

/**
 * One goal card on Today: what it is (its signature), its chip, today's step
 * (or what is done), the bars for its phase, and its one action. A passage's
 * or pack's Learned progress is its signature; Mastery stays a bar. Pure;
 * `now` is passed in.
 */

/** Sessions started from Today come back to Today. */
export const TODAY_RETURN = "/memory";

/** Pack reviews show as chips: all of them up to this many, else one fewer plus "+N more". */
const REVIEW_CHIP_LIMIT = 6;

export type GoalChip = { tone: "done"; label: string };

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
  /** The label in a compact row: "8 min", or `label` with no estimate. */
  shortLabel: string;
  href: string;
}

/** One verse on a passage's ruler. */
export interface GoalRulerTick {
  state: PassagePieceState;
  /** Today's session works on this verse. */
  today: boolean;
}

/** A pack's members in one status. */
export interface GoalMemberGroup {
  status: MemoryStatus;
  count: number;
}

interface GoalProgress {
  label: string;
  detail: string | null;
  fraction: number;
  ariaLabel: string;
}

/**
 * What sits under the title for a passage or a pack: a passage's verses as a
 * ruler, or a pack's verses as dots (most learned first). A verse carries its
 * span here; its card does not preview the words.
 */
export type GoalSignature =
  | { kind: "verse"; span: VerseSpan }
  | (GoalProgress & {
      kind: "passage";
      phase: PassageDueStatus;
      ticks: GoalRulerTick[];
    })
  | (GoalProgress & { kind: "pack"; members: GoalMemberGroup[] });

export const GOAL_KIND_NAME: Record<GoalCard["kind"], string> = {
  passage: "Passage",
  pack: "Pack",
  verse: "Verse",
};

export interface TodayGoalCardModel {
  /** "Passage · 11 verses" */
  kindLabel: string;
  signature: GoalSignature;
  chip: GoalChip | null;
  steps: GoalStep[];
  bars: GoalBar[];
  action: GoalAction | null;
  /** Today's step, or what is done, on one line for a compact row. */
  summary: string;
}

type GoalBody = Omit<TodayGoalCardModel, "kindLabel" | "chip" | "summary">;

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

/**
 * Only "Done today" earns a chip: a card with work today already says so
 * with its step line and its one button.
 */
function chipFor(goal: GoalCard, doneToday: boolean): GoalChip | null {
  return !goal.hasWorkToday && doneToday
    ? { tone: "done", label: "Done today" }
    : null;
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

function passageSignature(
  goal: PassageGoalCard,
  now: number,
  timeZone: string | undefined,
): GoalSignature {
  const building = goal.status === "building";
  return {
    kind: "passage",
    phase: goal.status,
    ticks: goal.pieceStates.flatMap((piece) =>
      Array.from({ length: piece.verses }, () => ({
        state: piece.state,
        today: piece.today,
      })),
    ),
    label: building
      ? `${goal.learnedVerses} of ${plural(goal.verseCount, "verse")} learned`
      : goal.verseCount === 1
        ? "1 verse learned"
        : `All ${goal.verseCount} verses learned`,
    detail: building ? goalLearnPace(goal, now, timeZone) : null,
    fraction: goal.verseCount === 0 ? 0 : goal.learnedVerses / goal.verseCount,
    ariaLabel: `Learned ${goal.learnedVerses} of ${plural(goal.verseCount, "verse")}`,
  };
}

function packMemberGroups(goal: PackGoalCard): GoalMemberGroup[] {
  const groups: GoalMemberGroup[] = [
    { status: "mastered", count: goal.mastered },
    { status: "reviewing", count: goal.learned - goal.mastered },
    { status: "learning", count: goal.learning },
    { status: "new", count: goal.upNext },
  ];
  return groups.filter((group) => group.count > 0);
}

function passageModel(
  goal: PassageGoalCard,
  now: number,
  timeZone: string | undefined,
  doneToday: boolean,
): GoalBody {
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

  const recite = goal.hasWorkToday
    ? "review today"
    : goal.nextDueAt === null
      ? null
      : `next review ${formatDueDay(goal.nextDueAt, now, timeZone)}`;
  const bars: GoalBar[] = building
    ? []
    : [
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

  let action: GoalAction | null = null;
  const main = goal.hasWorkToday
    ? passageDetailActions(goal, now, timeZone).main
    : null;
  if (main?.kind === "session") {
    const minutes = estimateSessionMinutes({
      learningVerses: 0,
      reviewVerses: 0,
      passageSessions: 1,
    });
    action = building
      ? {
          kind: "learn",
          label: startOrContinue(goal, minutes),
          shortLabel: `${minutes} min`,
          href: sessionHref(goal.packId, main.session),
        }
      : {
          kind: "review",
          label: "Review",
          shortLabel: "Review",
          href: sessionHref(goal.packId, main.session),
        };
  }

  return {
    signature: passageSignature(goal, now, timeZone),
    steps,
    bars,
    action,
  };
}

function packModel(
  goal: PackGoalCard,
  now: number,
  timeZone: string | undefined,
  doneToday: boolean,
): GoalBody {
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
  const signature: GoalSignature = {
    kind: "pack",
    ...progress.learned,
    ariaLabel: `Learned ${goal.learned} of ${plural(goal.verseCount, "verse")}`,
    members: packMemberGroups(goal),
  };
  const bars: GoalBar[] = progress.mastery
    ? [
        {
          track: "mastery",
          ...progress.mastery,
          ariaLabel: `Mastery ${percent(goal.masteryFraction)} percent`,
        },
      ]
    : [];

  let action: GoalAction | null = null;
  const main = goal.hasWorkToday
    ? packDetailActions(goal, now, timeZone).main
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
            shortLabel: `${minutes} min`,
            href: sessionHref(goal.packId, main.session),
          }
        : {
            kind: "learn",
            label: startOrContinue(goal, minutes),
            shortLabel: `${minutes} min`,
            href: sessionHref(goal.packId, main.session),
          };
  }

  return { signature, steps, bars, action };
}

function verseModel(
  goal: VerseGoalCard,
  now: number,
  timeZone: string | undefined,
  doneToday: boolean,
): GoalBody {
  const href = (kind: "learn" | "review") =>
    withReturn(memoryVerseSessionHref(kind, goal), TODAY_RETURN);
  const signature: GoalSignature = {
    kind: "verse",
    span: {
      book: goal.book,
      chapter: goal.chapter,
      startVerse: goal.startVerse,
      endVerse: goal.endVerse,
    },
  };

  if (isReviewPhase(goal.status)) {
    const label =
      goal.status === "mastered"
        ? "Mastered"
        : `Mastery ${percent(goal.masteryFraction)}%`;
    const minutes = estimateSessionMinutes({
      learningVerses: 0,
      reviewVerses: 1,
      passageSessions: 0,
    });
    return {
      signature,
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
            label: `Review · ${minutes} min`,
            shortLabel: `${minutes} min`,
            href: href("review"),
          }
        : null,
    };
  }

  const day = stepLadderDay(goal.learnStage);
  // Read and First letters are day one's one session, so the next session
  // after a step is never day one (`nextStepCopy` says the same).
  const tomorrow = `Tomorrow: ${stepAction(Math.max(goal.learnStage, 2))}.`;
  const upNext = goal.status === "new";
  let steps: GoalStep[];
  if (goal.hasWorkToday) {
    steps = [{ kind: "learn", ...todayStepParts(stepAction(goal.learnStage)) }];
  } else if (upNext) {
    steps = [{ kind: "note", text: "Up next. Starts when you're ready." }];
  } else {
    steps = [
      doneToday
        ? { kind: "done", text: `Today's step done. ${tomorrow}` }
        : { kind: "note", text: tomorrow },
    ];
  }

  const minutes = estimateSessionMinutes({
    learningVerses: 1,
    reviewVerses: 0,
    passageSessions: 0,
  });
  return {
    signature,
    steps,
    bars: [
      {
        track: "learned",
        label: upNext ? "Not started" : "Learning",
        detail: goalLearnPace(goal, now, timeZone),
        fraction: (day - 1) / 3,
        ariaLabel: upNext ? "Not started" : "Learning",
      },
    ],
    action:
      goal.hasWorkToday || upNext
        ? {
            kind: "learn",
            label: startOrContinue(goal, minutes),
            shortLabel: `${minutes} min`,
            href: href("learn"),
          }
        : null,
  };
}

function kindLabel(goal: GoalCard): string {
  const name = GOAL_KIND_NAME[goal.kind];
  return goal.kind === "verse"
    ? name
    : `${name} · ${plural(goal.verseCount, "verse")}`;
}

/** "fill in the blanks for verse 4." → "Fill in the blanks for verse 4" */
function asPhrase(text: string): string {
  const trimmed = text.replace(/\.$/, "");
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function stepSummary(step: GoalStep): string {
  switch (step.kind) {
    case "learn":
      return asPhrase(step.rest);
    case "reviews":
      return `${plural(step.labels.length + step.more, "review")} due`;
    case "learnCount":
    case "review":
    case "done":
    case "note":
      return asPhrase(step.text);
  }
}

function summaryFor(body: GoalBody): string {
  if (body.steps.length > 0) return body.steps.map(stepSummary).join(" · ");
  const progress =
    body.bars[0] ?? (body.signature.kind === "verse" ? null : body.signature);
  if (!progress) return "";
  return progress.detail
    ? `${progress.label} · ${progress.detail}`
    : progress.label;
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
    summary: summaryFor(body),
  };
}
