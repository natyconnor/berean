import { normalizeTimeZone } from "./dashboard-buckets";
import {
  buildGoalCards,
  localDayStart,
  type GoalCard,
  type GoalsInput,
  type PassageGoalCard,
} from "./memory-goals";
import {
  calendarDaysBetween,
  estimateSessionMinutes,
  formatShortDate,
} from "./memorize-plan";
import { isDueForLearning, isDueForReview } from "./memory-scheduler";

/**
 * The Today home in one model: what is left today, what was done today, the
 * status totals for "Your verses", and the goal cards. Pure, like
 * `memory-goals.ts`; `memoryHome.today` loads the rows.
 */

export type TodayState = "firstRun" | "work" | "caughtUp";

export interface TodayCounts {
  /** Open learning verses plus pack Up-next verses joining today (the learn queue). */
  learningVerses: number;
  /** Building passages with a learning session today. */
  passageSessions: number;
  /** Due reviews: verses, packs reviewed together, and passages (`memoryStats.due`). */
  reviews: number;
}

export interface TodayDone {
  /** Verses and passage verses that took a learning step today. */
  learningSteps: number;
  /** Verses and passages reviewed today. */
  reviews: number;
}

export interface TodayStatusCounts {
  /** Up next and learning, as the Learning filter counts them. */
  learning: number;
  memorized: number;
  mastered: number;
}

/** A pack with nothing in Memory: no goal card, but still on Your verses. */
export interface TodayEmptyPack<P extends string = string> {
  packId: P;
  title: string;
  createdAt: number;
}

export interface TodayModel<
  P extends string = string,
  V extends string = string,
> {
  /** `firstRun`: nothing in Memory. `caughtUp`: nothing left today. */
  state: TodayState;
  counts: TodayCounts;
  doneToday: TodayDone;
  /** A learning step, review, or passage session was logged today. */
  startedToday: boolean;
  /** Soonest scheduled session after `now`, learning or review. */
  nextReviewAt: number | null;
  /** Any verse memorized or mastered (Extra practice has something to use). */
  hasAnythingMemorized: boolean;
  /** In-Memory verses (passage verses are counted on their goal). */
  totalInMemory: number;
  statusCounts: TodayStatusCounts;
  goals: GoalCard<P, V>[];
  emptyPacks: TodayEmptyPack<P>[];
}

export interface TodayVerseLog {
  verseRefId: string;
  mode: "learn" | "review" | "deck" | "practice";
  createdAt: number;
}

export interface TodayPassageLog {
  passageMemoryId: string;
  kind: "rope" | "repair" | "review" | "frontier";
  pieceIndex?: number;
  createdAt: number;
}

export interface TodayInput<
  P extends string = string,
  V extends string = string,
> extends GoalsInput<P, V> {
  /** Up-next verses joining learning today, each once. */
  upNextVerseRefIds: readonly V[];
  /** Review logs since local midnight. */
  verseLogs: readonly TodayVerseLog[];
  passageLogs: readonly TodayPassageLog[];
}

/** The model for someone with nothing in Memory (or signed out). */
export function emptyTodayModel<
  P extends string = string,
  V extends string = string,
>(): TodayModel<P, V> {
  return {
    state: "firstRun",
    counts: { learningVerses: 0, passageSessions: 0, reviews: 0 },
    doneToday: { learningSteps: 0, reviews: 0 },
    startedToday: false,
    nextReviewAt: null,
    hasAnythingMemorized: false,
    totalInMemory: 0,
    statusCounts: { learning: 0, memorized: 0, mastered: 0 },
    goals: [],
    emptyPacks: [],
  };
}

function summarizeToday(
  verseLogs: readonly TodayVerseLog[],
  passageLogs: readonly TodayPassageLog[],
  dayStart: number,
): { done: TodayDone; started: boolean } {
  const learnedVerses = new Set<string>();
  const reviewedVerses = new Set<string>();
  const learnedPieces = new Set<string>();
  const reviewedPassages = new Set<string>();
  let started = false;

  for (const log of verseLogs) {
    if (log.createdAt < dayStart) continue;
    if (log.mode === "learn") learnedVerses.add(log.verseRefId);
    else if (log.mode === "review") reviewedVerses.add(log.verseRefId);
    else continue;
    started = true;
  }
  for (const log of passageLogs) {
    if (log.createdAt < dayStart) continue;
    started = true;
    if (log.kind === "frontier" && log.pieceIndex !== undefined) {
      learnedPieces.add(`${log.passageMemoryId}:${log.pieceIndex}`);
    } else if (log.kind === "review") {
      reviewedPassages.add(log.passageMemoryId);
    }
  }

  return {
    done: {
      learningSteps: learnedVerses.size + learnedPieces.size,
      reviews: reviewedVerses.size + reviewedPassages.size,
    },
    started,
  };
}

function soonestAfter(
  times: readonly (number | null)[],
  now: number,
): number | null {
  let soonest: number | null = null;
  for (const at of times) {
    if (at === null || at <= now) continue;
    if (soonest === null || at < soonest) soonest = at;
  }
  return soonest;
}

export function buildTodayModel<P extends string, V extends string>(
  input: TodayInput<P, V>,
): TodayModel<P, V> {
  const { now, verses } = input;
  const goals = buildGoalCards(input);
  const passageGoals = goals.filter(
    (goal): goal is PassageGoalCard<P> => goal.kind === "passage",
  );

  let learningOpen = 0;
  let verseReviews = 0;
  const statusCounts: TodayStatusCounts = {
    learning: 0,
    memorized: 0,
    mastered: 0,
  };
  const scheduled: Array<number | null> = passageGoals.map(
    (goal) => goal.nextDueAt,
  );

  for (const verse of verses) {
    if (isDueForLearning(verse, now)) learningOpen += 1;
    if (
      isDueForReview(verse, now) &&
      !input.reviewTogetherVerseRefIds.has(verse.verseRefId)
    ) {
      verseReviews += 1;
    }
    if (verse.status === "reviewing") statusCounts.memorized += 1;
    else if (verse.status === "mastered") statusCounts.mastered += 1;
    else statusCounts.learning += 1;
    if (verse.status !== "new") scheduled.push(verse.dueAt);
  }

  const togetherReviews = [...input.reviewTogether.values()].filter(
    (dueAt) => dueAt !== null,
  ).length;
  const counts: TodayCounts = {
    learningVerses: learningOpen + input.upNextVerseRefIds.length,
    passageSessions: passageGoals.filter(
      (goal) => goal.status === "building" && goal.hasWorkToday,
    ).length,
    reviews:
      verseReviews +
      togetherReviews +
      passageGoals.filter(
        (goal) => goal.status !== "building" && goal.hasWorkToday,
      ).length,
  };

  const { done, started } = summarizeToday(
    input.verseLogs,
    input.passageLogs,
    localDayStart(now, input.tzOffsetMinutes),
  );
  const hasMemory = verses.length > 0 || input.passages.length > 0;
  const goalPackIds = new Set<string>(
    goals.flatMap((goal) => (goal.kind === "verse" ? [] : [goal.packId])),
  );

  return {
    state: !hasMemory
      ? "firstRun"
      : todayWorkCount(counts) === 0
        ? "caughtUp"
        : "work",
    counts,
    doneToday: done,
    startedToday: started,
    nextReviewAt: soonestAfter(scheduled, now),
    hasAnythingMemorized: statusCounts.memorized + statusCounts.mastered > 0,
    totalInMemory: verses.length,
    statusCounts,
    goals,
    emptyPacks: input.packs
      .filter((pack) => !goalPackIds.has(pack.packId))
      .map((pack) => ({
        packId: pack.packId,
        title: pack.name,
        createdAt: pack.createdAt,
      })),
  };
}

/** Everything left today, passages counted once each. */
export function todayWorkCount(counts: TodayCounts): number {
  return counts.learningVerses + counts.passageSessions + counts.reviews;
}

/** "about N min" for everything left today; 0 when nothing is left. */
export function todaySessionMinutes(counts: TodayCounts): number {
  return estimateSessionMinutes({
    learningVerses: counts.learningVerses,
    reviewVerses: counts.reviews,
    passageSessions: counts.passageSessions,
  });
}

/** "3 to learn · 5 to review", leaving out a zero part; `null` when nothing is left. */
export function todayHeadline(counts: TodayCounts): string | null {
  const learn = counts.learningVerses + counts.passageSessions;
  const parts = [
    learn > 0 ? `${learn} to learn` : null,
    counts.reviews > 0 ? `${counts.reviews} to review` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "4 learning steps and 5 reviews done today."; `null` when nothing was done. */
export function todayDoneLine(done: TodayDone): string | null {
  const parts = [
    done.learningSteps > 0
      ? countOf(done.learningSteps, "learning step")
      : null,
    done.reviews > 0 ? countOf(done.reviews, "review") : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : `${parts.join(" and ")} done today.`;
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();

function formatLongWeekday(at: number, timeZone?: string): string {
  const zone = timeZone === undefined ? undefined : normalizeTimeZone(timeZone);
  const key = zone ?? "";
  let formatter = weekdayFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: zone,
    });
    weekdayFormatters.set(key, formatter);
  }
  return formatter.format(new Date(at));
}

/**
 * When the next session is, for "next review {day}": "later today",
 * "tomorrow", a weekday within the week ("Sunday"), else "Oct 20". `null`
 * when nothing is scheduled.
 */
export function formatNextReviewDay(
  nextReviewAt: number | null,
  now: number,
  timeZone?: string,
): string | null {
  if (nextReviewAt === null) return null;
  const days = calendarDaysBetween(now, nextReviewAt, timeZone);
  if (days <= 0) return "later today";
  if (days === 1) return "tomorrow";
  if (days < 7) return formatLongWeekday(nextReviewAt, timeZone);
  return formatShortDate(new Date(nextReviewAt), timeZone);
}
