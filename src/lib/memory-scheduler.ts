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
 *    hidden. After graduating, exact recalls stay daily for
 *    {@link REVIEW_DAILY_REPS} reviews, then every other day for
 *    {@link REVIEW_EVERY_OTHER_REPS} reviews; only then does the interval
 *    multiply by ease. Imperfect-but-passing recalls keep the current gap.
 *    Due dates land at local midnight N calendar days later (with a 6-hour
 *    floor so a late-night 1-day review does not reopen at 12:01am).
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
  /**
   * Learning: exact reps banked on the current support band.
   * Reviewing: exact recalls at the current early interval (daily, then
   * every-other-day). Unused once the interval has started growing with ease.
   */
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
 * Read is a single priming pass. Guided and Challenge scale with verse length,
 * capped so even a long passage stays at five recalls for the hardest band.
 * From Memory is always two recalls so a verse cannot graduate on one lucky
 * pass, without dragging the last step out.
 */
const BAND_REP_RANGE: Record<
  SupportBand["key"],
  readonly [min: number, max: number]
> = {
  read: [1, 1],
  guided: [3, 5],
  challenge: [4, 5],
  memory: [2, 2],
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
 * Read (0) is always 1. Guided (1) scales 3→5 and Challenge (2) 4→5, linearly
 * between {@link SHORT_VERSE_WORDS} and {@link LONG_VERSE_WORDS}. From Memory
 * (3) is always 2. Omitting `wordCount` (or passing a value ≤
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
 * recalls stay in the review queue but do not stretch the interval.
 */
export const REVIEW_LAPSE_ACCURACY = 60;

/**
 * Exact reviewing recalls while the interval is still 1 day. The verse stays
 * due tomorrow until this many exacts have landed, then moves to every other
 * day.
 */
export const REVIEW_DAILY_REPS = 4;

/**
 * Exact reviewing recalls while the interval is 2 days. After this many, the
 * interval starts multiplying by ease.
 */
export const REVIEW_EVERY_OTHER_REPS = 4;

/** Interval (days) used for the post-graduation daily streak. */
export const REVIEW_DAILY_INTERVAL_DAYS = 1;

/** Interval (days) used for the every-other-day streak. */
export const REVIEW_EVERY_OTHER_INTERVAL_DAYS = 2;

/**
 * Near-perfect Read / Guided / Challenge attempts still bank a rep. This lets
 * one missed word or a small typo count on a longer passage without allowing a
 * merely passing recall to clear a support band. From Memory requires
 * `quality === "exact"` (grade-time classification already allows a couple of
 * typos).
 */
export const LEARN_PROGRESS_ACCURACY = 85;

/**
 * After a review lapse, re-enter learning at Guided (first-letters) rather than
 * Read — the learner still remembers some of the verse.
 */
export const REVIEW_LAPSE_LEARN_STAGE = 1;

export const DAY_MS = 24 * 60 * 60 * 1000;

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
 * Also the gap that distinguishes a session lock (`dueAt` a morning ahead of
 * `lastReviewedAt`) from an in-progress verse (existing `dueAt`, still due).
 */
export const MIN_LEARNING_LOCK_MS = 6 * 60 * 60 * 1000;

/**
 * Inclusive upper bound for due-index scans that also count in-progress
 * learning. Attempts persist with a live `Date.now()` while dock/dashboard
 * queries freeze `now` for the JS session, so an in-progress row can sit
 * minutes-to-hours ahead of the query clock without being a session lock.
 * Locks are still excluded by {@link isDueForLearning}.
 */
export function dueIndexUntil(now: number): number {
  return now + MIN_LEARNING_LOCK_MS;
}

/**
 * When the next session opens: local midnight `intervalDays` calendar days
 * from today (rounded to a whole day, at least 1). A 6-hour floor keeps a
 * late-night 1-day gap from reopening minutes after midnight.
 *
 * `tzOffsetMinutes` is the client's `Date.prototype.getTimezoneOffset()`
 * (minutes to add to local time to reach UTC, e.g. 420 for UTC-7). Without it
 * the local day is unknowable, so the due date falls back to a rolling day.
 */
export function dueAtInCalendarDays(
  now: number,
  intervalDays: number,
  tzOffsetMinutes?: number,
): number {
  const days = Math.max(1, Math.round(intervalDays));
  if (tzOffsetMinutes === undefined || !Number.isFinite(tzOffsetMinutes)) {
    return now + days * DAY_MS;
  }
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const localNow = now - offsetMs;
  const startOfLocalDay = Math.floor(localNow / DAY_MS) * DAY_MS;
  const calendarDue = startOfLocalDay + days * DAY_MS + offsetMs;
  return Math.max(calendarDue, now + MIN_LEARNING_LOCK_MS);
}

/**
 * When the learner's next learning session opens: the start of their next
 * local day. Same rule as a 1-day review.
 */
export function nextLearningSessionDueAt(
  now: number,
  tzOffsetMinutes?: number,
): number {
  return dueAtInCalendarDays(now, 1, tzOffsetMinutes);
}

/**
 * Slack allowed when comparing a learning `dueAt` against a caller clock that
 * has no `lastReviewedAt`. In-progress stamps sit at `now`; session locks sit
 * a morning ahead. The two real values are hours apart, so a 30-minute window
 * cannot confuse them — it only covers rows whose last-attempt time is missing.
 */
export const LEARNING_LOCK_GRACE_MS = 30 * 60 * 1000;

function clampEase(ease: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, ease));
}

/**
 * Stay due on the existing timestamp while today's session is still open.
 * Attempts use a live `Date.now()` while dock/dashboard queries freeze `now`
 * for the JS session; pushing `dueAt` forward to the attempt would drop the
 * verse from `dueAt <= now` scans before the day's reps are finished.
 */
function inProgressLearningDueAt(previousDueAt: number, now: number): number {
  return Math.min(previousDueAt, now);
}

/**
 * Convert an interval (in days) into a concrete `dueAt` timestamp. Lands at
 * local midnight N calendar days later (6-hour floor). A zero interval means
 * "again this session", so it stays at `now`.
 */
function computeDueAt(input: ReviewInput, intervalDays: number): number {
  if (intervalDays <= 0) return input.now;
  return dueAtInCalendarDays(input.now, intervalDays, input.tzOffsetMinutes);
}

/** True while the verse is still on the learn ladder (not yet graduated). */
export function isLearningPhase(status: MemoryStatus): boolean {
  return status === "new" || status === "learning";
}

/** True once the verse has graduated into spaced review. */
export function isReviewPhase(status: MemoryStatus): boolean {
  return status === "reviewing" || status === "mastered";
}

/**
 * Whether a learning attempt is strong enough to bank progress.
 *
 * Read / Guided / Challenge accept an exact recall or a close one at
 * {@link LEARN_PROGRESS_ACCURACY}. From Memory is the last confirmation, so
 * only `exact` counts — a couple of minor typos still qualify because they
 * are classified as exact at grade time.
 */
export function isLearningProgressAttempt(
  quality: ReviewInput["quality"],
  accuracy: number,
  learnStage: number,
): boolean {
  if (learnStage >= MAX_LEARN_STAGE) {
    return quality === "exact";
  }
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

/** Status/due fields plus optional `lastReviewedAt` from the persisted row. */
export type MemoryAvailability = Pick<MemorySchedule, "status" | "dueAt"> & {
  lastReviewedAt?: number;
};

/**
 * True when `dueAt` is a next-session lock rather than an open session.
 * In-progress learning keeps `dueAt` at the existing due time and stamps
 * `lastReviewedAt` to the attempt; a session-ending clear pushes `dueAt` at
 * least {@link MIN_LEARNING_LOCK_MS} ahead.
 */
function isLearningSessionClosed(schedule: MemoryAvailability): boolean {
  if (schedule.lastReviewedAt === undefined) return false;
  return schedule.dueAt - schedule.lastReviewedAt >= MIN_LEARNING_LOCK_MS;
}

/**
 * Whether an in-progress learning verse can take a progress-banking attempt
 * now. Only `learning` (already started) qualifies — hearted `new` verses are
 * available for Practice but do not inflate “to learn today” / dock badge
 * counts until the learner has begun. Soft-locked verses (`dueAt` a session
 * ahead after a session-ending band clear) return false until the next
 * calendar session.
 *
 * Pass `lastReviewedAt` when the row has it so an in-progress `dueAt` stamp
 * is not mistaken for a lock against a stale caller clock.
 */
export function isDueForLearning(
  schedule: MemoryAvailability,
  now: number,
): boolean {
  return schedule.status === "learning" && !isLearningLocked(schedule, now);
}

/**
 * Whether a verse belongs in the Library Due view right now.
 *
 * Due review and unlocked learning both qualify. Hearted `new` verses and
 * session-locked learning (“Tomorrow”) do not.
 */
export function isDueForLibrary(
  schedule: MemoryAvailability,
  now: number,
): boolean {
  return isDueForReview(schedule, now) || isDueForLearning(schedule, now);
}

/**
 * True when the verse is still learning but today's session is done — Practice
 * and list CTAs should show a soft-lock "back tomorrow" state.
 *
 * Hearted `new` verses are never locked: they have not started a session, even
 * if `dueAt` was stamped with a live clock ahead of a frozen UI `now`.
 */
export function isLearningLocked(
  schedule: MemoryAvailability,
  now: number,
): boolean {
  if (schedule.status !== "learning") return false;
  if (
    schedule.lastReviewedAt !== undefined &&
    !isLearningSessionClosed(schedule)
  ) {
    return false;
  }
  return schedule.dueAt - now > LEARNING_LOCK_GRACE_MS;
}

function scheduleLearning(s: MemorySchedule, r: ReviewInput): MemorySchedule {
  if (isLearningProgressAttempt(r.quality, r.accuracy, s.learnStage)) {
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
          dueAt: computeDueAt(r, intervalDays),
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
          : inProgressLearningDueAt(s.dueAt, r.now),
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
      dueAt: inProgressLearningDueAt(s.dueAt, r.now),
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
      dueAt: inProgressLearningDueAt(s.dueAt, r.now),
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
      dueAt: inProgressLearningDueAt(s.dueAt, r.now),
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
      dueAt: inProgressLearningDueAt(s.dueAt, r.now),
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
    dueAt: inProgressLearningDueAt(s.dueAt, r.now),
    consecutiveCorrect: 0,
    lapses: s.lapses,
    earlyReviewApplied: false,
  };
}

/**
 * Which post-graduation band the current interval belongs to.
 *
 * Intervals still at 1 day are the daily streak; 2 days is every-other-day.
 * Anything longer (including leftover SM-2 growth from before this ladder)
 * multiplies by ease on each exact.
 */
function reviewingIntervalStep(intervalDays: number): 1 | 2 | "growing" {
  const rounded = Math.max(1, Math.round(intervalDays));
  if (rounded <= 1) return 1;
  if (rounded === 2) return 2;
  return "growing";
}

function nextReviewingOnExact(
  s: MemorySchedule,
): Pick<
  MemorySchedule,
  "status" | "intervalDays" | "ease" | "stageReps" | "consecutiveCorrect"
> {
  const step = reviewingIntervalStep(s.intervalDays);
  const consecutiveCorrect = s.consecutiveCorrect + 1;

  if (step === 1) {
    const reps = s.stageReps + 1;
    if (reps >= REVIEW_DAILY_REPS) {
      return {
        status: "reviewing",
        intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
        ease: s.ease,
        stageReps: 0,
        consecutiveCorrect,
      };
    }
    return {
      status: "reviewing",
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: s.ease,
      stageReps: reps,
      consecutiveCorrect,
    };
  }

  if (step === 2) {
    const reps = s.stageReps + 1;
    if (reps >= REVIEW_EVERY_OTHER_REPS) {
      const intervalDays = REVIEW_EVERY_OTHER_INTERVAL_DAYS * s.ease;
      return {
        status:
          intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "reviewing",
        intervalDays,
        ease: clampEase(s.ease + 0.05),
        stageReps: 0,
        consecutiveCorrect,
      };
    }
    return {
      status: "reviewing",
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      ease: s.ease,
      stageReps: reps,
      consecutiveCorrect,
    };
  }

  const intervalDays = s.intervalDays * s.ease;
  return {
    status: intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "reviewing",
    intervalDays,
    ease: clampEase(s.ease + 0.05),
    stageReps: 0,
    consecutiveCorrect,
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
    const next = nextReviewingOnExact(s);
    return {
      ...next,
      learnStage: s.learnStage,
      dueAt: computeDueAt(r, next.intervalDays),
      lapses: s.lapses,
      earlyReviewApplied: isEarly,
    };
  }

  // close (and former "off but ≥60%"): keep the current gap. A messy recall
  // should not earn more time before the next review.
  const intervalDays = Math.max(REVIEW_DAILY_INTERVAL_DAYS, s.intervalDays);
  return {
    status: s.status,
    learnStage: s.learnStage,
    stageReps: s.stageReps,
    ease: s.ease,
    intervalDays,
    dueAt: computeDueAt(r, intervalDays),
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
