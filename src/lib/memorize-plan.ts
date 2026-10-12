import { normalizeTimeZone } from "./dashboard-buckets";
import { stepDayLine } from "./memory-copy";
import {
  DAY_MS,
  initialSchedule,
  isLearningLocked,
  isLearningPhase,
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  scheduleNext,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";
import { PACK_ACTIVE_LEARNING_CAP } from "./pack-pacing";
import { PASSAGE_MAX_ADDS_PER_DAY } from "./passage-frontier";

/**
 * Plain-language plans for memorizing something: how long the learning steps
 * take, how long until it is mastered, and what happens next. Learning time
 * and mastery time are separate facts and are never added into one headline.
 *
 * Pure: `now` is always passed in, and mastery is simulated with the real
 * scheduler so the estimate moves whenever scheduler constants do.
 */

export type MemorizeMode = "verse" | "passage" | "pack";

export interface MemorizeSize {
  mode: MemorizeMode;
  verseCount: number;
}

export interface MemorizeProgress extends MemorizeSize {
  /** Verses that have already finished the learning steps. */
  learnedCount: number;
}

/**
 * Calendar days one verse spends on the learning steps: Read and First letters
 * on day 1, Fill in the blanks on day 2, From memory on day 3. The scheduler
 * soft-locks the verse overnight after day 1 and day 2.
 */
const VERSE_LEARN_DAYS = 3;

/** Past this many days out, a projected date reads as a month. */
const MONTH_ONLY_AFTER_DAYS = 42;

const DAYS_PER_MONTH = 365.25 / 12;

/** Bounds the scheduler simulation if a scheduler change ever stops it converging. */
const SIMULATION_STEP_LIMIT = 500;

// Heuristics, not measurements: rough minutes per item for "about N min".
export const MINUTES_PER_LEARNING_VERSE = 2;
export const MINUTES_PER_REVIEW = 0.5;
export const MINUTES_PER_PASSAGE_SESSION = 4;

function wholeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Days until the learning steps are done, assuming a session every day.
 *
 * A verse takes {@link VERSE_LEARN_DAYS}. A passage adds up to
 * {@link PASSAGE_MAX_ADDS_PER_DAY} verses a day, and the last one still needs
 * its remaining steps. A pack keeps {@link PACK_ACTIVE_LEARNING_CAP} verses
 * learning at once.
 */
export function estimateMemorizeDays({
  mode,
  verseCount,
}: MemorizeSize): number {
  const count = wholeCount(verseCount);
  if (count === 0) return 0;
  switch (mode) {
    case "verse":
      return VERSE_LEARN_DAYS;
    case "passage":
      return Math.ceil(count / PASSAGE_MAX_ADDS_PER_DAY) + VERSE_LEARN_DAYS - 1;
    case "pack":
      return VERSE_LEARN_DAYS * Math.ceil(count / PACK_ACTIVE_LEARNING_CAP);
  }
}

/**
 * "Learn it in about 4 days". `short` drops the "Learn it in " lead for tight
 * UI ("about 4 days").
 */
export function formatLearnDuration(
  days: number,
  opts?: { short?: boolean },
): string {
  const rounded = Number.isFinite(days) ? Math.max(1, Math.round(days)) : 1;
  const span =
    rounded === 1
      ? "about a day"
      : rounded <= 6
        ? `about ${rounded} days`
        : rounded <= 10
          ? "about a week"
          : `about ${Math.round(rounded / 7)} weeks`;
  return opts?.short ? span : `Learn it in ${span}`;
}

function exactAttempt(now: number, mode: ReviewInput["mode"]): ReviewInput {
  return { quality: "exact", accuracy: 100, mode, now };
}

/**
 * Runs one verse up the learning ladder with exact grades, jumping the clock
 * to each soft lock. No time zone, so every gap is a whole number of days.
 */
function simulateLearningLadder(start: number): {
  schedule: MemorySchedule;
  graduatedAt: number;
} {
  let now = start;
  let schedule = initialSchedule(now);
  for (
    let step = 0;
    step < SIMULATION_STEP_LIMIT && isLearningPhase(schedule.status);
    step += 1
  ) {
    schedule = scheduleNext(schedule, exactAttempt(now, "learn"));
    if (isLearningPhase(schedule.status) && schedule.dueAt > now) {
      now = schedule.dueAt;
    }
  }
  return { schedule, graduatedAt: now };
}

/**
 * Days from finishing the learning steps until the verse first becomes
 * `mastered`, if every review is exact and done on its due day.
 */
export function estimateReviewDaysToMastery(): number {
  const { schedule: graduated, graduatedAt } = simulateLearningLadder(0);
  let schedule = graduated;
  let now = graduatedAt;
  for (
    let step = 0;
    step < SIMULATION_STEP_LIMIT && schedule.status !== "mastered";
    step += 1
  ) {
    now = Math.max(now, schedule.dueAt);
    schedule = scheduleNext(schedule, exactAttempt(now, "review"));
  }
  return Math.round((now - graduatedAt) / DAY_MS);
}

/** Learning days plus review days until mastered. 0 for an empty target. */
export function estimateMasteryDays(size: MemorizeSize): number {
  const learnDays = estimateMemorizeDays(size);
  if (learnDays === 0) return 0;
  return learnDays + estimateReviewDaysToMastery();
}

/**
 * "Mastered in about 5 weeks" under 8 weeks, else "Mastered in about N
 * months" (at least 2).
 */
export function formatMasteryDuration(days: number): string {
  const safeDays = Number.isFinite(days) ? Math.max(0, days) : 0;
  if (safeDays < 8 * 7) {
    const weeks = Math.max(1, Math.round(safeDays / 7));
    return weeks === 1
      ? "Mastered in about a week"
      : `Mastered in about ${weeks} weeks`;
  }
  const months = Math.max(2, Math.round(safeDays / DAYS_PER_MONTH));
  return `Mastered in about ${months} months`;
}

/** Fill for a mastery bar: the review gap as a share of the mastered gap. */
export function masteryProgress(intervalDays: number): number {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) return 0;
  return Math.min(intervalDays / MASTERED_INTERVAL_DAYS, 1);
}

/** Rough session length in whole minutes; 0 when there is nothing to do. */
export function estimateSessionMinutes({
  learningVerses,
  reviewVerses,
  passageSessions,
}: {
  learningVerses: number;
  reviewVerses: number;
  passageSessions: number;
}): number {
  const minutes =
    wholeCount(learningVerses) * MINUTES_PER_LEARNING_VERSE +
    wholeCount(reviewVerses) * MINUTES_PER_REVIEW +
    wholeCount(passageSessions) * MINUTES_PER_PASSAGE_SESSION;
  if (minutes === 0) return 0;
  return Math.max(1, Math.round(minutes));
}

export type NextStepSchedule = Pick<
  MemorySchedule,
  "status" | "learnStage" | "dueAt"
> & {
  /** Lets an in-progress verse read as open against a stale clock. */
  lastReviewedAt?: number;
};

/**
 * Forward-looking line for one verse: what today's step is, or what comes
 * next once today's step is done.
 */
export function nextStepCopy(
  schedule: NextStepSchedule,
  now: number,
  timeZone?: string,
): string {
  if (schedule.status === "new") return "Up next. Starts when you're ready.";

  if (schedule.status === "learning") {
    if (!isLearningLocked(schedule, now)) {
      return stepDayLine(schedule.learnStage);
    }
    return schedule.learnStage >= MAX_LEARN_STAGE
      ? "Great. Tomorrow you'll say it from memory."
      : "Nice. Tomorrow you'll try it with blanks.";
  }

  const daysAway = calendarDaysBetween(now, schedule.dueAt, timeZone);
  if (schedule.dueAt <= now || daysAway <= 0) return "Review due today";
  if (daysAway === 1) {
    return schedule.status === "reviewing"
      ? "Memorized. We'll bring it back tomorrow to keep it fresh."
      : "Next review tomorrow";
  }
  const due = new Date(schedule.dueAt);
  return `Next review ${
    daysAway < 7 ? formatWeekday(due, timeZone) : formatShortDate(due, timeZone)
  }`;
}

/**
 * When something is next due, for short lines: "today" (or overdue),
 * "tomorrow", a weekday within the week ("Thu"), else "Oct 20".
 */
export function formatDueDay(
  dueAt: number,
  now: number,
  timeZone?: string,
): string {
  const daysAway = calendarDaysBetween(now, dueAt, timeZone);
  if (dueAt <= now || daysAway <= 0) return "today";
  if (daysAway === 1) return "tomorrow";
  const due = new Date(dueAt);
  return daysAway < 7
    ? formatWeekday(due, timeZone)
    : formatShortDate(due, timeZone);
}

function remainingVerses({ verseCount, learnedCount }: MemorizeProgress) {
  return Math.max(0, wholeCount(verseCount) - wholeCount(learnedCount));
}

function addCalendarDays(now: number, days: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * The day the learning steps should finish with a session every day. Today
 * counts as day 1; already-learned targets finish today.
 */
export function projectedFinishDate(
  progress: MemorizeProgress,
  now: number,
): Date {
  const days = estimateMemorizeDays({
    mode: progress.mode,
    verseCount: remainingVerses(progress),
  });
  return addCalendarDays(now, Math.max(0, days - 1));
}

/**
 * The day it would first be mastered if every review passes. A target that
 * has finished learning is projected as if it graduated today.
 */
export function projectedMasteryDate(
  progress: MemorizeProgress,
  now: number,
): Date {
  const remaining = remainingVerses(progress);
  const offset =
    remaining > 0
      ? estimateMasteryDays({ mode: progress.mode, verseCount: remaining }) - 1
      : estimateReviewDaysToMastery();
  return addCalendarDays(now, offset);
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(
  kind: "dayKey" | "shortDate" | "weekday" | "month",
  timeZone: string | undefined,
): Intl.DateTimeFormat {
  const zone = timeZone === undefined ? undefined : normalizeTimeZone(timeZone);
  const key = `${kind}|${zone ?? ""}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions =
      kind === "dayKey"
        ? { year: "numeric", month: "numeric", day: "numeric" }
        : kind === "shortDate"
          ? { month: "short", day: "numeric" }
          : kind === "weekday"
            ? { weekday: "short" }
            : { month: "long" };
    formatter = new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: zone,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Whole local calendar days from `from` to `to` (negative when earlier). */
export function calendarDaysBetween(
  from: number,
  to: number,
  timeZone?: string,
): number {
  return calendarDayNumber(to, timeZone) - calendarDayNumber(from, timeZone);
}

function calendarDayNumber(ms: number, timeZone: string | undefined): number {
  const parts = dateFormatter("dayKey", timeZone).formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Math.round(
    Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS,
  );
}

function formatWeekday(date: Date, timeZone?: string): string {
  return dateFormatter("weekday", timeZone).format(date);
}

/** "Oct 20". */
export function formatShortDate(date: Date, timeZone?: string): string {
  return dateFormatter("shortDate", timeZone).format(date);
}

/** "Oct 20", or "around December" once the date is more than 6 weeks out. */
export function formatMonthOrDate(
  date: Date,
  now: number,
  timeZone?: string,
): string {
  if (date.getTime() - now > MONTH_ONLY_AFTER_DAYS * DAY_MS) {
    return `around ${dateFormatter("month", timeZone).format(date)}`;
  }
  return formatShortDate(date, timeZone);
}
