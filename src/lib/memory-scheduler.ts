/**
 * Pure spaced-repetition scheduler for verse memory.
 *
 * The whole model in one sentence: get it right and the gap grows; miss it and
 * it comes back tomorrow. This module is intentionally framework-free (no Convex,
 * no React) so it is trivially unit-testable and can run anywhere.
 *
 * A verse moves through two phases:
 *  - Learning phase (`new` / `learning`): the learner steps through display
 *    stages 0..3 (full | first-letters | cloze | hidden) within a session.
 *  - Reviewing phase (`reviewing` / `mastered`): the verse is recalled from
 *    hidden and the inter-review interval grows or shrinks with performance.
 */

/** Verse-memory lifecycle status. */
export type MemoryStatus =
  | "new"
  | "learning"
  | "reviewing"
  | "mastered"
  | "suspended";

export interface MemorySchedule {
  status: MemoryStatus;
  learnStage: number;
  ease: number;
  intervalDays: number;
  dueAt: number;
  consecutiveCorrect: number;
  lapses: number;
}

export interface ReviewInput {
  quality: "exact" | "close" | "off";
  accuracy: number;
  mode: "learn" | "review" | "deck";
  now: number; // pass `now` IN (Convex forbids Date.now() in queries)
}

/** Ease bounds. Ease starts at {@link EASE_START} for freshly-seeded verses. */
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const EASE_START = 2.3;

/** learnStage 0..3 = full | first-letters | cloze | hidden. */
export const MAX_LEARN_STAGE = 3;

/** Interval (days) at or beyond which a reviewing verse becomes `mastered`. */
export const MASTERED_INTERVAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Interval spread applied to due dates so reviews don't bunch up (+/-10%). */
const FUZZ_RATIO = 0.1;

function clampEase(ease: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, ease));
}

/**
 * Deterministic pseudo-random offset in the range [-FUZZ_RATIO, FUZZ_RATIO].
 *
 * Seeded purely off numeric input so the same attempt always yields the same
 * fuzz, keeping unit tests stable while still spreading review load in practice.
 */
function deterministicFuzz(seed: number): number {
  const x = Math.sin(seed) * 10000;
  const frac = x - Math.floor(x);
  return (frac * 2 - 1) * FUZZ_RATIO;
}

/**
 * Convert an interval (in days) into a concrete `dueAt` timestamp, applying the
 * +/-10% fuzz. A zero interval means "again this session", so it stays at `now`.
 */
function computeDueAt(
  input: ReviewInput,
  priorIntervalDays: number,
  intervalDays: number,
): number {
  if (intervalDays <= 0) return input.now;
  const seed = input.now + input.accuracy + priorIntervalDays;
  const factor = 1 + deterministicFuzz(seed);
  return Math.round(input.now + intervalDays * factor * DAY_MS);
}

function isLearningPhase(status: MemoryStatus): boolean {
  return status === "new" || status === "learning";
}

function scheduleLearning(s: MemorySchedule, r: ReviewInput): MemorySchedule {
  if (r.quality === "exact") {
    // Nailed the hidden stage -> graduate into the reviewing phase.
    if (s.learnStage >= MAX_LEARN_STAGE) {
      const intervalDays = 1;
      return {
        status: "reviewing",
        learnStage: MAX_LEARN_STAGE,
        ease: s.ease,
        intervalDays,
        dueAt: computeDueAt(r, s.intervalDays, intervalDays),
        consecutiveCorrect: s.consecutiveCorrect + 1,
        lapses: s.lapses,
      };
    }
    // Advance to the next display stage; retry again this session.
    return {
      status: "learning",
      learnStage: s.learnStage + 1,
      ease: s.ease,
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: s.consecutiveCorrect + 1,
      lapses: s.lapses,
    };
  }

  if (r.quality === "close") {
    // Stay on the current stage and try it again this session.
    return {
      status: "learning",
      learnStage: s.learnStage,
      ease: s.ease,
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: s.consecutiveCorrect,
      lapses: s.lapses,
    };
  }

  // off: drop back a stage (floored at 0) and reset the streak.
  return {
    status: "learning",
    learnStage: Math.max(0, s.learnStage - 1),
    ease: s.ease,
    intervalDays: 0,
    dueAt: r.now,
    consecutiveCorrect: 0,
    lapses: s.lapses,
  };
}

function scheduleReviewing(s: MemorySchedule, r: ReviewInput): MemorySchedule {
  if (r.quality === "off") {
    // Lapse: reset the interval, ding the ease, and relearn from stage 0.
    const intervalDays = 1;
    return {
      status: "learning",
      learnStage: 0,
      ease: clampEase(s.ease - 0.2),
      intervalDays,
      dueAt: computeDueAt(r, s.intervalDays, intervalDays),
      consecutiveCorrect: 0,
      lapses: s.lapses + 1,
    };
  }

  if (r.quality === "close") {
    // Grow the interval, but conservatively; leave ease untouched.
    const intervalDays = s.intervalDays * s.ease * 0.8;
    return {
      status: intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "reviewing",
      learnStage: s.learnStage,
      ease: s.ease,
      intervalDays,
      dueAt: computeDueAt(r, s.intervalDays, intervalDays),
      consecutiveCorrect: s.consecutiveCorrect,
      lapses: s.lapses,
    };
  }

  // exact: full interval growth and a small ease bump.
  const intervalDays = s.intervalDays * s.ease;
  return {
    status: intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "reviewing",
    learnStage: s.learnStage,
    ease: clampEase(s.ease + 0.05),
    intervalDays,
    dueAt: computeDueAt(r, s.intervalDays, intervalDays),
    consecutiveCorrect: s.consecutiveCorrect + 1,
    lapses: s.lapses,
  };
}

/**
 * Compute the next schedule for a verse given a single graded attempt.
 *
 * Pure: same inputs always produce the same output (including `dueAt`).
 */
export function scheduleNext(
  s: MemorySchedule,
  r: ReviewInput,
): MemorySchedule {
  // A suspended verse is opted out of scheduling; attempts never touch it.
  if (s.status === "suspended") return s;
  if (isLearningPhase(s.status)) {
    return scheduleLearning(s, r);
  }
  return scheduleReviewing(s, r);
}

/**
 * A fresh, unseen verse: `new` status at the first display stage, default ease,
 * and due immediately.
 */
export function initialSchedule(now: number): MemorySchedule {
  return {
    status: "new",
    learnStage: 0,
    ease: EASE_START,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
  };
}
