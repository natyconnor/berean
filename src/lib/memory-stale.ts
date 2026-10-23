import {
  DAY_MS,
  LEARN_PROGRESS_ACCURACY,
  isLearningPhase,
  isReviewPhase,
} from "./memory-scheduler";

export type RecentReview = {
  accuracy: number;
  lapsed: boolean;
  createdAt?: number;
};

export type ReviewHistoryRow = {
  accuracy: number;
  createdAt?: number;
  hint?: "first-letters";
  holdSchedule?: boolean;
  mode?: "learn" | "review" | "deck" | "practice";
  kind?: "rope" | "repair" | "review" | "frontier";
};

const STALE_MIN_DAYS = 7;
const SHAKY_ACCURACY = 80;

function lastThree<T>(items: readonly T[]): T[] {
  return items.slice(0, 3);
}

function lapseCount(reviews: readonly RecentReview[]): number {
  return lastThree(reviews).filter((review) => review.lapsed).length;
}

function meanAccuracy(reviews: readonly RecentReview[]): number | null {
  const recent = lastThree(reviews);
  if (recent.length === 0) return null;
  return (
    recent.reduce((sum, review) => sum + review.accuracy, 0) / recent.length
  );
}

/**
 * Whether Review should offer a first-letters refresher. Never shown as a
 * label. A reviewing verse is stale when it is overdue by at least a week or
 * its own gap, whichever is longer, or when two of the last three tries
 * lapsed. A learning verse is stale after a week mid-ladder.
 */
export function isStaleVerse(input: {
  status: "new" | "learning" | "reviewing" | "mastered";
  dueAt: number;
  intervalDays: number;
  lastReviewedAt?: number;
  learnStage?: number;
  now: number;
  startedOverAt?: number;
  lastReviews: readonly RecentReview[];
}): boolean {
  const lastReviews =
    input.startedOverAt === undefined
      ? input.lastReviews
      : input.lastReviews.filter(
          (review) =>
            review.createdAt === undefined ||
            review.createdAt >= input.startedOverAt!,
        );
  const lastReviewedAt =
    input.startedOverAt !== undefined &&
    input.lastReviewedAt !== undefined &&
    input.lastReviewedAt < input.startedOverAt
      ? undefined
      : input.lastReviewedAt;

  if (lapseCount(lastReviews) >= 2) return true;

  if (isReviewPhase(input.status)) {
    const overdueMs = input.now - input.dueAt;
    const staleAfterMs =
      Math.max(STALE_MIN_DAYS, Math.max(1, input.intervalDays)) * DAY_MS;
    return overdueMs >= staleAfterMs;
  }

  if (!isLearningPhase(input.status)) return false;
  if (lastReviewedAt === undefined) return false;
  const midLadder = (input.learnStage ?? 0) > 0 || lastReviewedAt !== undefined;
  if (!midLadder) return false;
  return input.now - lastReviewedAt >= STALE_MIN_DAYS * DAY_MS;
}

/** A ≥85% first-letters try that should restore the kept interval tomorrow. */
export function isReviewHintedCheckIn(
  row: ReviewHistoryRow | null | undefined,
): boolean {
  if (!row || row.holdSchedule) return false;
  if (row.hint !== "first-letters") return false;
  if (row.accuracy < LEARN_PROGRESS_ACCURACY) return false;
  if (row.mode !== undefined) return row.mode === "review";
  if (row.kind !== undefined) return row.kind === "review";
  return false;
}

/**
 * Lapses among the last three review-mode tries recorded before a Refresh
 * sitting started. Practice and the sitting's own passes do not count.
 */
export function refreshRecentLapseCount(
  rows: readonly ReviewHistoryRow[],
  sittingStartedAt: number,
): number {
  return lapseCount(
    rows
      .filter((row) => {
        const reviewMode = row.mode === "review" || row.kind === "review";
        return (
          reviewMode &&
          row.createdAt !== undefined &&
          row.createdAt < sittingStartedAt
        );
      })
      .map((row) => ({
        accuracy: row.accuracy,
        lapsed: recentReviewLapsed(row.accuracy),
      })),
  );
}

/**
 * Whether a passage or pack verse is shaky enough to be the default Start
 * over / Refresh target. Two lapses in the last three tries, or an average
 * under 80% across those tries.
 */
export function isShakyVerse(lastReviews: readonly RecentReview[]): boolean {
  if (lastReviews.length === 0) return false;
  if (lapseCount(lastReviews) >= 2) return true;
  const average = meanAccuracy(lastReviews);
  return average !== null && average < SHAKY_ACCURACY;
}

export function recentReviewLapsed(accuracy: number): boolean {
  return accuracy < 60;
}
