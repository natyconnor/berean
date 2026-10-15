import type { ReviewSessionAttempt } from "@/lib/review-session-attempts";

import type { SessionCompleteVerse } from "./session-complete";

/**
 * What a Today session finished on earlier visits the same day, so leaving
 * and coming back keeps the count and the summary whole. One record per
 * session scope (all of today, one pack, or one half), kept in localStorage
 * and dropped once the day changes.
 */
export interface TodaySessionCarry {
  /** Queue items finished, as counted in "Today · 4 of 12". */
  doneItems: number;
  /** Passages finished for the day, by title. */
  passages: string[];
  learned: SessionCompleteVerse[];
  attempts: ReviewSessionAttempt[];
}

export const EMPTY_TODAY_CARRY: TodaySessionCarry = {
  doneItems: 0,
  passages: [],
  learned: [],
  attempts: [],
};

const KEY_PREFIX = "berean:today-session:";

type CarryRecord = TodaySessionCarry & { day: number };

export function hasTodayCarry(carry: TodaySessionCarry): boolean {
  return (
    carry.doneItems > 0 ||
    carry.passages.length > 0 ||
    carry.learned.length > 0 ||
    carry.attempts.length > 0
  );
}

/** Earlier work plus this visit's: passages once, a verse's latest step. */
export function mergeTodayCarry(
  earlier: TodaySessionCarry,
  later: TodaySessionCarry,
): TodaySessionCarry {
  const learned = new Map(earlier.learned.map((verse) => [verse.id, verse]));
  for (const verse of later.learned) learned.set(verse.id, verse);
  return {
    doneItems: earlier.doneItems + later.doneItems,
    passages: [...new Set([...earlier.passages, ...later.passages])],
    learned: [...learned.values()],
    attempts: [...earlier.attempts, ...later.attempts],
  };
}

export function readTodayCarry(
  scope: string,
  dayKey: number,
): TodaySessionCarry {
  const store = localStore();
  if (!store) return EMPTY_TODAY_CARRY;
  try {
    const raw = store.getItem(KEY_PREFIX + scope);
    if (!raw) return EMPTY_TODAY_CARRY;
    const record = toCarryRecord(JSON.parse(raw) as unknown);
    if (!record || record.day !== dayKey) {
      store.removeItem(KEY_PREFIX + scope);
      return EMPTY_TODAY_CARRY;
    }
    return {
      doneItems: record.doneItems,
      passages: record.passages,
      learned: record.learned,
      attempts: record.attempts,
    };
  } catch {
    return EMPTY_TODAY_CARRY;
  }
}

export function writeTodayCarry(
  scope: string,
  dayKey: number,
  carry: TodaySessionCarry,
): void {
  try {
    const store = localStore();
    if (!store) return;
    if (!hasTodayCarry(carry)) {
      store.removeItem(KEY_PREFIX + scope);
      return;
    }
    const record: CarryRecord = { day: dayKey, ...carry };
    store.setItem(KEY_PREFIX + scope, JSON.stringify(record));
  } catch {
    // Ignore quota and private-mode failures; this visit still counts.
  }
}

function localStore(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasReference(value: Record<string, unknown>): boolean {
  const reference = value.reference;
  return (
    isRecord(reference) &&
    typeof reference.book === "string" &&
    typeof reference.chapter === "number" &&
    typeof reference.startVerse === "number" &&
    typeof reference.endVerse === "number"
  );
}

function toCarryRecord(value: unknown): CarryRecord | null {
  if (!isRecord(value)) return null;
  const { day, doneItems, passages, learned, attempts } = value;
  if (
    typeof day !== "number" ||
    typeof doneItems !== "number" ||
    !Array.isArray(passages) ||
    !Array.isArray(learned) ||
    !Array.isArray(attempts)
  ) {
    return null;
  }
  return {
    day,
    doneItems: Math.max(0, Math.trunc(doneItems)),
    passages: passages.filter(
      (title): title is string => typeof title === "string",
    ),
    learned: learned.filter(
      (verse): verse is SessionCompleteVerse =>
        isRecord(verse) &&
        typeof verse.id === "string" &&
        typeof verse.status === "string" &&
        typeof verse.learnStage === "number" &&
        hasReference(verse),
    ),
    attempts: attempts.filter(
      (attempt): attempt is ReviewSessionAttempt =>
        isRecord(attempt) &&
        typeof attempt.accuracy === "number" &&
        hasReference(attempt),
    ),
  };
}
