/**
 * Pure spaced-repetition scheduler for verse memory.
 *
 * The whole model in one sentence: get it right and the gap grows; miss it and
 * it comes back tomorrow. This module is intentionally framework-free (no Convex,
 * no React) so it is trivially unit-testable and can run anywhere.
 *
 * A verse moves through two phases:
 *  - Learning phase (`new` / `learning`): the learner steps through display
 *    stages 0..3 (full | first-letters | cloze | hidden) across ~3 calendar
 *    sessions. Day 1 is Read + Guided; clearing Guided or Challenge soft-locks
 *    the verse until tomorrow (`dueAt` in the future). Day 3 clears From Memory
 *    and graduates.
 *  - Reviewing phase (`reviewing` / `mastered`): the verse is recalled from
 *    hidden and the inter-review interval grows or shrinks with performance.
 *
 * Early practice (before `dueAt`) may reschedule once from "now" so a successful
 * early review still counts — but further early successes leave the interval
 * alone until the verse is due again. Long-term memory needs real time gaps;
 * extra reps can still boost accuracy without accelerating the schedule.
 */

/** Verse-memory lifecycle status. */
export type MemoryStatus = "new" | "learning" | "reviewing" | "mastered";

export interface MemorySchedule {
  status: MemoryStatus;
  learnStage: number;
  stageReps: number;
  ease: number;
  intervalDays: number;
  dueAt: number;
  consecutiveCorrect: number;
  lapses: number;
  /**
   * True after a successful early (pre-due) review already advanced this
   * interval. Cleared on the next due/overdue review or on a lapse. Extra early
   * successes while this is set leave the schedule unchanged.
   */
  earlyReviewApplied: boolean;
}

/**
 * A learning-phase support band. `index === learnStage` (0..3): index 0 is the
 * most support (Read), index 3 is the least (From Memory). A band only clears
 * after {@link SupportBand.requiredReps} strong reps are banked.
 */
export interface SupportBand {
  key: "read" | "guided" | "challenge" | "memory";
  label: string;
  requiredReps: number;
  densityStart: number | null; // first-letter hint fraction at rep 0; null = full text
  densityEnd: number | null; // hint fraction at the last rep (fades within a band)
}

/**
 * Word-count thresholds for the length-based rep curve.
 *
 * ≤SHORT_VERSE_WORDS → band minima; ≥LONG_VERSE_WORDS → band maxima; in
 * between the counts are linearly interpolated.
 */
export const SHORT_VERSE_WORDS = 10;
export const LONG_VERSE_WORDS = 24;

/**
 * Reps each band needs at the short and long endpoints (~5 reps/session feel).
 *
 * Read is a single priming pass. The other three are one session's work each,
 * so From Memory carries a real rep count too rather than graduating a verse on
 * one lucky recall.
 */
const BAND_REP_RANGE: Record<
  SupportBand["key"],
  readonly [min: number, max: number]
> = {
  read: [1, 1],
  guided: [3, 5],
  challenge: [4, 6],
  memory: [3, 4],
};

/**
 * Single source of truth for the learning-phase bands; index === learnStage.
 *
 * `requiredReps` is the **short-verse minimum** from {@link BAND_REP_RANGE}.
 * Use {@link requiredRepsFor} to get the length-adjusted count at runtime.
 */
export const SUPPORT_BANDS: readonly SupportBand[] = [
  {
    key: "read",
    label: "Read",
    requiredReps: BAND_REP_RANGE.read[0],
    densityStart: null,
    densityEnd: null,
  },
  {
    key: "guided",
    label: "Guided",
    requiredReps: BAND_REP_RANGE.guided[0],
    densityStart: 0.25,
    densityEnd: 1.0,
  },
  {
    key: "challenge",
    label: "Challenge",
    requiredReps: BAND_REP_RANGE.challenge[0],
    densityStart: 0.65,
    densityEnd: 0.15,
  },
  {
    key: "memory",
    label: "From Memory",
    requiredReps: BAND_REP_RANGE.memory[0],
    densityStart: 0.0,
    densityEnd: 0.0,
  },
];

/**
 * Exact reps needed to clear the band at `stage`, adjusted for verse length.
 *
 * Read (0) is always 1. Guided (1) scales 3→5, Challenge (2) 4→6, and From
 * Memory (3) 3→4, linearly between {@link SHORT_VERSE_WORDS} and
 * {@link LONG_VERSE_WORDS}. Omitting `wordCount` (or passing a value ≤
 * SHORT_VERSE_WORDS) yields the short-verse minima.
 */
export function requiredRepsFor(stage: number, wordCount?: number): number {
  const band = SUPPORT_BANDS[stage];
  if (!band) return 1;

  const [min, max] = BAND_REP_RANGE[band.key];
  if (min === max) return min;

  const words = wordCount ?? SHORT_VERSE_WORDS;
  const clamped = Math.min(
    LONG_VERSE_WORDS,
    Math.max(SHORT_VERSE_WORDS, words),
  );
  const t =
    (clamped - SHORT_VERSE_WORDS) / (LONG_VERSE_WORDS - SHORT_VERSE_WORDS);

  return Math.round(min + (max - min) * t);
}

export interface ReviewInput {
  quality: "exact" | "close" | "off";
  accuracy: number;
  mode: "learn" | "review" | "deck" | "practice";
  now: number; // pass `now` IN (Convex forbids Date.now() in queries)
  /** Word count of the verse text; drives the length-based rep curve. */
  wordCount?: number;
  /**
   * Client's `getTimezoneOffset()`, so a learning soft lock lands on the start
   * of their next local day. Omitted falls back to a rolling day.
   */
  tzOffsetMinutes?: number;
}

/** Ease bounds. Ease starts at {@link EASE_START} for freshly-seeded verses. */
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const EASE_START = 2.3;

/** learnStage 0..3 = full | first-letters | cloze | hidden. */
export const MAX_LEARN_STAGE = 3;

/** Interval (days) at or beyond which a reviewing verse becomes `mastered`. */
export const MASTERED_INTERVAL_DAYS = 30;

/**
 * Review accuracy below this lapses back into learning. At or above, imperfect
 * recalls stay in the review queue with conservative interval growth.
 */
export const REVIEW_LAPSE_ACCURACY = 60;

/**
 * Near-perfect learning attempts still bank a rep. This lets one missed word
 * or a small typo count on a longer passage without allowing a merely passing
 * recall to clear a support band.
 */
export const LEARN_PROGRESS_ACCURACY = 85;

/**
 * After a review lapse, re-enter learning at Guided (first-letters) rather than
 * Read — the learner still remembers some of the verse.
 */
export const REVIEW_LAPSE_LEARN_STAGE = 1;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Interval spread applied to due dates so reviews don't bunch up (+/-10%). */
const FUZZ_RATIO = 0.1;

/**
 * Clearing Guided (1) or Challenge (2) ends today's learning session: advance
 * to the next band and soft-lock until tomorrow. Read (0) stays same-day;
 * From Memory (3) graduates instead.
 */
export function isLearningSessionEndingStage(stage: number): boolean {
  return stage === 1 || stage === 2;
}

/**
 * Floor on a soft lock, so a session finished just before midnight can't reopen
 * minutes later. Small enough that the verse still comes back the next morning.
 */
const MIN_LEARNING_LOCK_MS = 6 * 60 * 60 * 1000;

/**
 * When the learner's next session opens: the start of their next local day, so
 * finishing at 8pm reopens the next morning rather than 24 hours later.
 *
 * `tzOffsetMinutes` is the client's `Date.prototype.getTimezoneOffset()`
 * (minutes to add to local time to reach UTC, e.g. 420 for UTC-7). Without it
 * the local day is unknowable, so the lock falls back to a rolling day.
 */
export function nextLearningSessionDueAt(
  now: number,
  tzOffsetMinutes?: number,
): number {
  if (tzOffsetMinutes === undefined || !Number.isFinite(tzOffsetMinutes)) {
    return now + DAY_MS;
  }
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const localNow = now - offsetMs;
  const nextLocalMidnight = (Math.floor(localNow / DAY_MS) + 1) * DAY_MS;
  return Math.max(nextLocalMidnight + offsetMs, now + MIN_LEARNING_LOCK_MS);
}

/**
 * Slack allowed when comparing a learning `dueAt` against the caller's clock.
 *
 * A learning verse only ever holds one of two due dates: `now` when it is still
 * available this session, or ~24h out when the session ended. Callers compare
 * against a coarse clock (the UI refreshes it every few minutes) that can trail
 * the timestamp an attempt was stamped with, so a bare `dueAt > now` reads a
 * just-recorded rep as locked. The two real values are a day apart, so treating
 * anything inside this window as "available now" cannot confuse them.
 */
export const LEARNING_LOCK_GRACE_MS = 30 * 60 * 1000;

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

/** True while the verse is still on the learn ladder (not yet graduated). */
export function isLearningPhase(status: MemoryStatus): boolean {
  return status === "new" || status === "learning";
}

/** True once the verse has graduated into spaced review. */
export function isReviewPhase(status: MemoryStatus): boolean {
  return status === "reviewing" || status === "mastered";
}

/** Whether a learning attempt is strong enough to bank progress. */
export function isLearningProgressAttempt(
  quality: ReviewInput["quality"],
  accuracy: number,
): boolean {
  return (
    quality === "exact" ||
    (quality === "close" && accuracy >= LEARN_PROGRESS_ACCURACY)
  );
}

/**
 * Whether a verse belongs in the review queue right now.
 *
 * Only `reviewing` / `mastered` verses with `dueAt <= now` qualify. Learning-
 * phase verses use {@link isDueForLearning} instead and must not inflate the
 * review queue.
 */
export function isDueForReview(
  schedule: Pick<MemorySchedule, "status" | "dueAt">,
  now: number,
): boolean {
  return isReviewPhase(schedule.status) && schedule.dueAt <= now;
}

/**
 * Whether an in-progress learning verse can take a progress-banking attempt
 * now. Only `learning` (already started) qualifies — hearted `new` verses are
 * available for Practice but do not inflate “to learn today” / dock badge
 * counts until the learner has begun. Soft-locked verses (`dueAt` a session
 * ahead after a session-ending band clear) return false until the next
 * calendar session.
 */
export function isDueForLearning(
  schedule: Pick<MemorySchedule, "status" | "dueAt">,
  now: number,
): boolean {
  return (
    schedule.status === "learning" &&
    schedule.dueAt - now <= LEARNING_LOCK_GRACE_MS
  );
}

/**
 * True when the verse is still learning but today's session is done — Practice
 * and list CTAs should show a soft-lock "back tomorrow" state.
 */
export function isLearningLocked(
  schedule: Pick<MemorySchedule, "status" | "dueAt">,
  now: number,
): boolean {
  return (
    isLearningPhase(schedule.status) &&
    schedule.dueAt - now > LEARNING_LOCK_GRACE_MS
  );
}

function scheduleLearning(s: MemorySchedule, r: ReviewInput): MemorySchedule {
  if (isLearningProgressAttempt(r.quality, r.accuracy)) {
    const reps = s.stageReps + 1;
    if (reps >= requiredRepsFor(s.learnStage, r.wordCount)) {
      // Cleared this band on its required reps.
      if (s.learnStage >= MAX_LEARN_STAGE) {
        // Graduate into the reviewing phase with a fresh 1-day interval.
        const intervalDays = 1;
        return {
          status: "reviewing",
          learnStage: MAX_LEARN_STAGE,
          stageReps: 0,
          ease: s.ease,
          intervalDays,
          dueAt: computeDueAt(r, s.intervalDays, intervalDays),
          consecutiveCorrect: s.consecutiveCorrect + 1,
          lapses: s.lapses,
          earlyReviewApplied: false,
        };
      }
      // Advance to the next band. Guided/Challenge clears end today's session
      // (soft-lock until tomorrow); Read stays available the same day.
      const sessionEnding = isLearningSessionEndingStage(s.learnStage);
      return {
        status: "learning",
        learnStage: s.learnStage + 1,
        stageReps: 0,
        ease: s.ease,
        intervalDays: 0,
        dueAt: sessionEnding
          ? nextLearningSessionDueAt(r.now, r.tzOffsetMinutes)
          : r.now,
        consecutiveCorrect: s.consecutiveCorrect + 1,
        lapses: s.lapses,
        earlyReviewApplied: false,
      };
    }
    // Bank a rep on this band and try it again this session.
    return {
      status: "learning",
      learnStage: s.learnStage,
      stageReps: reps,
      ease: s.ease,
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: s.consecutiveCorrect + 1,
      lapses: s.lapses,
      earlyReviewApplied: false,
    };
  }

  if (r.quality === "close") {
    // Hold the band and its banked reps; try it again this session.
    return {
      status: "learning",
      learnStage: s.learnStage,
      stageReps: s.stageReps,
      ease: s.ease,
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: s.consecutiveCorrect,
      lapses: s.lapses,
      earlyReviewApplied: false,
    };
  }

  // off (soft step-back): lose one banked rep before dropping a band.
  // mid-band: stageReps -= 1, stay on band.
  // at 0 reps with a band above Read: drop one band, land at requiredRepsFor(prev) - 1.
  // already at Read 0/0: stay (floor).
  if (s.stageReps > 0) {
    return {
      status: "learning",
      learnStage: s.learnStage,
      stageReps: s.stageReps - 1,
      ease: s.ease,
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: 0,
      lapses: s.lapses,
      earlyReviewApplied: false,
    };
  }
  if (s.learnStage > 0) {
    const prevStage = s.learnStage - 1;
    return {
      status: "learning",
      learnStage: prevStage,
      stageReps: Math.max(0, requiredRepsFor(prevStage, r.wordCount) - 1),
      ease: s.ease,
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: 0,
      lapses: s.lapses,
      earlyReviewApplied: false,
    };
  }
  return {
    status: "learning",
    learnStage: 0,
    stageReps: 0,
    ease: s.ease,
    intervalDays: 0,
    dueAt: r.now,
    consecutiveCorrect: 0,
    lapses: s.lapses,
    earlyReviewApplied: false,
  };
}

function scheduleReviewing(s: MemorySchedule, r: ReviewInput): MemorySchedule {
  const isEarly = r.now < s.dueAt;

  if (r.accuracy < REVIEW_LAPSE_ACCURACY) {
    // Soft lapse: ding ease, count the lapse, and resume at Guided
    // (first-letters) instead of wiping back to Read. Always applies even when
    // early — a hard miss should not be ignored.
    return {
      status: "learning",
      learnStage: REVIEW_LAPSE_LEARN_STAGE,
      stageReps: 0,
      ease: clampEase(s.ease - 0.2),
      intervalDays: 0,
      dueAt: r.now,
      consecutiveCorrect: 0,
      lapses: s.lapses + 1,
      earlyReviewApplied: false,
    };
  }

  // One early success may push dueAt out from now; further early successes
  // leave the schedule alone until the verse is due again.
  if (isEarly && s.earlyReviewApplied) {
    return s;
  }

  if (r.quality === "exact") {
    // exact: full interval growth and a small ease bump.
    const intervalDays = s.intervalDays * s.ease;
    return {
      status: intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "reviewing",
      learnStage: s.learnStage,
      stageReps: s.stageReps,
      ease: clampEase(s.ease + 0.05),
      intervalDays,
      dueAt: computeDueAt(r, s.intervalDays, intervalDays),
      consecutiveCorrect: s.consecutiveCorrect + 1,
      lapses: s.lapses,
      earlyReviewApplied: isEarly,
    };
  }

  // close (and former "off but ≥60%"): grow the interval conservatively;
  // leave ease untouched.
  const intervalDays = s.intervalDays * s.ease * 0.8;
  return {
    status: intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "reviewing",
    learnStage: s.learnStage,
    stageReps: s.stageReps,
    ease: s.ease,
    intervalDays,
    dueAt: computeDueAt(r, s.intervalDays, intervalDays),
    consecutiveCorrect: s.consecutiveCorrect,
    lapses: s.lapses,
    earlyReviewApplied: isEarly,
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
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
    earlyReviewApplied: false,
  };
}
