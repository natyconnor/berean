import { MASTERED_INTERVAL_DAYS, type MemoryStatus } from "./memory-scheduler";

/**
 * Map a verse's memory state to a mastery-ring fill fraction in `[0, 1]`, used
 * to draw a subtle progress ring around the heart in the reader.
 *
 * Mapping (documented in docs/study-mode.md):
 * - `new` → 0 — no ring; the heart reads as "saved, not yet started".
 * - `learning` → 0.25 (a quarter) — in the learn ladder but not yet reviewing.
 * - `reviewing` → 0.5…0.9 — a half that grows with the interval, scaled linearly
 *   from just-graduated up to {@link MASTERED_INTERVAL_DAYS}.
 * - `mastered` → 1 (full) — interval has reached the mastered threshold.
 * - `suspended` → 0 — opted out of scheduling, so no progress is implied.
 */
export function masteryRingFraction(
  status: MemoryStatus,
  intervalDays: number,
): number {
  switch (status) {
    case "mastered":
      return 1;
    case "reviewing": {
      const t = Math.max(0, Math.min(1, intervalDays / MASTERED_INTERVAL_DAYS));
      return 0.5 + t * 0.4;
    }
    case "learning":
      return 0.25;
    case "new":
    case "suspended":
      return 0;
    default:
      return 0;
  }
}
