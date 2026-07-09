import {
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  requiredRepsFor,
  type MemoryStatus,
} from "./memory-scheduler";

/**
 * The learning phase fills the ring from 0 up to (but not reaching) this
 * ceiling; the reviewing band takes over from 0.5 upward, so a graduating verse
 * flows continuously from learning into reviewing.
 */
const LEARNING_RING_CEILING = 0.5;

/**
 * How far along the four-band learning journey a verse is, as a fraction in
 * `[0, 1]`. Each of the `(MAX_LEARN_STAGE + 1)` bands occupies an equal slice;
 * reps banked on the current band fill that slice proportionally.
 *
 * When `wordCount` is provided, the required-rep count for Guided and Challenge
 * is length-adjusted via {@link requiredRepsFor}, so the bar matches the card
 * and the server exactly.
 *
 * Graduating out of learning (`reviewing` / `mastered`) is a full journey: the
 * scheduler resets `stageReps` to 0 on graduation while leaving `learnStage` at
 * From Memory, so without `status` the bar would incorrectly stick at 75%.
 *
 * Pure: no React, no `Date.now()`.
 */
export function learningJourneyFraction(
  learnStage: number,
  stageReps: number,
  wordCount?: number,
  status?: MemoryStatus,
): number {
  if (status === "reviewing" || status === "mastered") return 1;
  const clampedStage = Math.max(0, Math.min(MAX_LEARN_STAGE, learnStage));
  const required = Math.max(1, requiredRepsFor(clampedStage, wordCount));
  const withinBand = Math.max(0, Math.min(1, stageReps / required));
  const bandCount = MAX_LEARN_STAGE + 1;
  const progress = (clampedStage + withinBand) / bandCount;
  return Math.max(0, Math.min(1, progress));
}

/**
 * Map a verse's memory state to a mastery-ring fill fraction in `[0, 1]`, used
 * to draw a subtle progress ring around the heart in the reader.
 *
 * Mapping (documented in docs/study-mode.md):
 * - `new` → 0 — no ring; the heart reads as "saved, not yet started".
 * - `learning` → 0…<0.5 — grows across the learn ladder as bands clear and reps
 *   bank, using `learnStage` + `stageReps` against each band's required reps
 *   ({@link requiredRepsFor}) so it approaches, but stays below, the reviewing
 *   floor.
 * - `reviewing` → 0.5…0.9 — a half that grows with the interval, scaled linearly
 *   from just-graduated up to {@link MASTERED_INTERVAL_DAYS}.
 * - `mastered` → 1 (full) — interval has reached the mastered threshold.
 *
 * Pure: no React, no `Date.now()`. `learnStage` / `stageReps` default to 0 so
 * callers without that data (or with legacy rows) degrade gracefully.
 */
export function masteryRingFraction(
  status: MemoryStatus,
  intervalDays: number,
  learnStage = 0,
  stageReps = 0,
): number {
  switch (status) {
    case "mastered":
      return 1;
    case "reviewing": {
      const t = Math.max(0, Math.min(1, intervalDays / MASTERED_INTERVAL_DAYS));
      return 0.5 + t * 0.4;
    }
    case "learning":
      // Reuse the shared fraction; multiply by the ceiling so the heart ring
      // and the progress bar never drift apart.
      return (
        learningJourneyFraction(learnStage, stageReps) * LEARNING_RING_CEILING
      );
    case "new":
      return 0;
    default:
      return 0;
  }
}
