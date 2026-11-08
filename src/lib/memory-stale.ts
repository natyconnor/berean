import { DAY_MS, isReviewPhase, type MemoryStatus } from "./memory-scheduler";

/** One graded try, newest first in a list. */
export type RecentReview = {
  accuracy: number;
  createdAt?: number;
};

const STALE_MIN_DAYS = 7;

/** A try under 60% is a lapse for the stale check; 60–84% is not. */
export function recentReviewLapsed(accuracy: number): boolean {
  return accuracy < 60;
}

/**
 * Whether a Memorized or Mastered verse is stale: overdue by at least a week
 * or its own gap, whichever is longer, or 2 of its last 3 tries lapsed.
 * `lastReviews` is newest first. After a Start over, only tries since the
 * reset count.
 */
export function isStaleVerse(input: {
  status: MemoryStatus;
  dueAt: number;
  intervalDays: number;
  now: number;
  startedOverAt?: number;
  lastReviews: readonly RecentReview[];
}): boolean {
  if (!isReviewPhase(input.status)) return false;

  const { startedOverAt } = input;
  const lapses = input.lastReviews
    .filter(
      (review) =>
        startedOverAt === undefined ||
        review.createdAt === undefined ||
        review.createdAt >= startedOverAt,
    )
    .slice(0, 3)
    .filter((review) => recentReviewLapsed(review.accuracy)).length;
  if (lapses >= 2) return true;

  const staleAfterMs = Math.max(STALE_MIN_DAYS, input.intervalDays) * DAY_MS;
  return input.now - input.dueAt >= staleAfterMs;
}
