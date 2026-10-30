import { normalizeTimeZone } from "./dashboard-buckets";
import { formatReviewIntervalPhrase } from "./memory-due-label";
import { calendarDaysBetween } from "./memorize-plan";
import {
  isLearningLocked,
  isReviewPhase,
  type MemoryStatus,
} from "./memory-scheduler";

/**
 * Plain-language facts for one verse's detail: when it is next up, the gap
 * between reviews, and how recent practice has gone. No scheduler terms.
 */

export interface VerseFact {
  label: string;
  value: string;
}

export interface VerseFactInput {
  status: MemoryStatus;
  learnStage: number;
  dueAt: number;
  intervalDays: number;
  lapses: number;
  lastReviewedAt?: number;
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** "Thu, Oct 15". */
function formatWeekdayDate(at: number, timeZone?: string): string {
  const zone = timeZone === undefined ? undefined : normalizeTimeZone(timeZone);
  const key = zone ?? "";
  let formatter = dayFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: zone,
    });
    dayFormatters.set(key, formatter);
  }
  return formatter.format(new Date(at));
}

/** "Today", "Tomorrow", or "Thu, Oct 15". */
export function formatFactDay(
  at: number,
  now: number,
  timeZone?: string,
): string {
  const days = calendarDaysBetween(now, at, timeZone);
  if (at <= now || days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatWeekdayDate(at, timeZone);
}

function learningNextStep(
  verse: VerseFactInput,
  now: number,
  timeZone?: string,
): string {
  if (verse.status === "new") return "When you're ready";
  if (!isLearningLocked(verse, now)) return "Today";
  return calendarDaysBetween(now, verse.dueAt, timeZone) <= 0
    ? "Later today"
    : "Tomorrow";
}

/** Next review · Gap between reviews · Times it slipped (left out at 0). */
export function verseDetailFacts(
  verse: VerseFactInput,
  now: number,
  timeZone?: string,
): VerseFact[] {
  const facts: VerseFact[] = [];
  if (isReviewPhase(verse.status)) {
    facts.push({
      label: "Next review",
      value: formatFactDay(verse.dueAt, now, timeZone),
    });
    const gap = formatReviewIntervalPhrase(verse.intervalDays);
    if (gap !== null) facts.push({ label: "Gap between reviews", value: gap });
  } else {
    facts.push({
      label: "Next step",
      value: learningNextStep(verse, now, timeZone),
    });
  }
  if (verse.lapses > 0) {
    facts.push({ label: "Times it slipped", value: String(verse.lapses) });
  }
  return facts;
}

export type HowItsGoingLabel = "Solid" | "A few slips" | "Needs another pass";

export interface HowItsGoing {
  label: HowItsGoingLabel;
  /** Mean accuracy (0–100) of the attempts it looked at. */
  averageAccuracy: number;
  attempts: number;
}

const RECENT_ATTEMPTS = 5;
const SOLID_ACCURACY = 90;
const FEW_SLIPS_ACCURACY = 70;

export type HowItsGoingAttempt = {
  accuracy: number;
  hint?: "first-letters";
  holdSchedule?: boolean;
  createdAt?: number;
};

export function unhintedAttempts<
  T extends { hint?: "first-letters"; holdSchedule?: boolean },
>(attempts: readonly T[]): T[] {
  return attempts.filter(
    (attempt) => attempt.hint === undefined && !attempt.holdSchedule,
  );
}

/** Accuracies that should move the How it's going readout. */
export function accuraciesForHowItsGoing(
  attempts: readonly HowItsGoingAttempt[],
  startedOverAt?: number,
): number[] {
  return unhintedAttempts(attempts)
    .filter(
      (attempt) =>
        startedOverAt === undefined ||
        attempt.createdAt === undefined ||
        attempt.createdAt >= startedOverAt,
    )
    .map((attempt) => attempt.accuracy);
}

/** From the latest attempts (newest first); `null` before any practice. */
export function howItsGoing(
  accuraciesNewestFirst: readonly number[],
): HowItsGoing | null {
  const recent = accuraciesNewestFirst.slice(0, RECENT_ATTEMPTS);
  if (recent.length === 0) return null;
  const averageAccuracy =
    recent.reduce((sum, accuracy) => sum + accuracy, 0) / recent.length;
  return {
    label:
      averageAccuracy >= SOLID_ACCURACY
        ? "Solid"
        : averageAccuracy >= FEW_SLIPS_ACCURACY
          ? "A few slips"
          : "Needs another pass",
    averageAccuracy,
    attempts: recent.length,
  };
}
