/**
 * Pure day-bucketing helpers for the Study progress dashboard.
 *
 * These functions turn flat lists of timestamps (review `createdAt`s, verse
 * `dueAt`s) into fixed-length per-day arrays the dashboard charts consume.
 * They are intentionally framework-free (no Convex, no React) so they are
 * trivially unit-testable and shared between the Convex aggregate queries and
 * any client-side derivation.
 *
 * **Timezone simplification.** Convex queries cannot call `Date.now()`, so the
 * client passes `now` in and all bucketing is done in **UTC days**. This keeps
 * the queries deterministic and cacheable at the cost of not honoring the
 * viewer's local timezone — a day boundary is midnight UTC, not local midnight.
 * That's an acceptable v1 tradeoff for a coarse growth dashboard; if per-user
 * local-day bucketing is needed later, the client can pass a UTC offset.
 */

export const DAY_MS = 86_400_000;

/** Midnight-UTC timestamp of the day containing `ts`. */
export function startOfUtcDay(ts: number): number {
  return Math.floor(ts / DAY_MS) * DAY_MS;
}

/**
 * The `days` UTC-day-start timestamps ending on the day of `now`, oldest first.
 * The last entry is always "today" (the UTC day of `now`).
 */
export function utcDayStarts(now: number, days: number): number[] {
  const todayStart = startOfUtcDay(now);
  const starts: number[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    starts.push(todayStart - i * DAY_MS);
  }
  return starts;
}

/**
 * Count timestamps into a `days`-long window ending today (UTC), oldest first.
 * Timestamps outside the window are ignored.
 */
export function bucketReviewCounts(
  createdAts: readonly number[],
  now: number,
  days: number,
): number[] {
  const starts = utcDayStarts(now, days);
  const windowStart = starts[0];
  const counts = new Array<number>(days).fill(0);
  for (const ts of createdAts) {
    const index = Math.floor((startOfUtcDay(ts) - windowStart) / DAY_MS);
    if (index >= 0 && index < days) {
      counts[index] += 1;
    }
  }
  return counts;
}

/**
 * Average `accuracy` per UTC day over a `days`-long window ending today, oldest
 * first. Days with no reviews get `null` (rather than 0) so charts can skip
 * them instead of drawing a misleading zero.
 */
export function bucketAccuracyAverages(
  reviews: readonly { createdAt: number; accuracy: number }[],
  now: number,
  days: number,
): Array<{ average: number | null; count: number }> {
  const starts = utcDayStarts(now, days);
  const windowStart = starts[0];
  const sums = new Array<number>(days).fill(0);
  const counts = new Array<number>(days).fill(0);
  for (const review of reviews) {
    const index = Math.floor(
      (startOfUtcDay(review.createdAt) - windowStart) / DAY_MS,
    );
    if (index >= 0 && index < days) {
      sums[index] += review.accuracy;
      counts[index] += 1;
    }
  }
  return counts.map((count, i) => ({
    average: count > 0 ? sums[i] / count : null,
    count,
  }));
}

/**
 * Count verse `dueAt`s into the next `days` UTC days starting today, oldest
 * first. Day 0 ("Today") counts only verses that are **actually due now**
 * (`dueAt <= now`), matching the rest of the app's "due today" definition
 * (`memoryStats.due`, `dueQueue`, the Start review disabled state) — so
 * overdue verses fold into Today but a verse scheduled for later today does
 * not. Upcoming days (1..) are bucketed by UTC calendar day; verses due later
 * today therefore fall outside the window's day-0 count and are not shown.
 * Verses due beyond the window are ignored.
 */
export function bucketForecastCounts(
  dueAts: readonly number[],
  now: number,
  days: number,
): number[] {
  const todayStart = startOfUtcDay(now);
  const counts = new Array<number>(days).fill(0);
  for (const dueAt of dueAts) {
    if (dueAt <= now) {
      // Due or overdue -> Today, consistent with `dueAt <= now` everywhere.
      counts[0] += 1;
      continue;
    }
    // Not yet due: bucket into its upcoming UTC calendar day. An index of 0
    // here means "later today" — kept out of the Today count (no calendar
    // bucket fits it) rather than inflating the "due now" number.
    const index = Math.floor((startOfUtcDay(dueAt) - todayStart) / DAY_MS);
    if (index >= 1 && index < days) {
      counts[index] += 1;
    }
  }
  return counts;
}

/**
 * The current review streak: consecutive days with at least one review, ending
 * today. Expects the oldest-first daily counts from {@link bucketReviewCounts}.
 * Returns 0 when today has no reviews yet.
 */
export function computeStreak(dailyCounts: readonly number[]): number {
  let streak = 0;
  for (let i = dailyCounts.length - 1; i >= 0; i -= 1) {
    if (dailyCounts[i] > 0) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Average of the day averages weighted by review count over the window — i.e.
 * the overall mean accuracy across all reviews in the window. Returns `null`
 * when there were no reviews.
 */
export function overallAccuracy(
  buckets: readonly { average: number | null; count: number }[],
): number | null {
  let sum = 0;
  let total = 0;
  for (const bucket of buckets) {
    if (bucket.average !== null && bucket.count > 0) {
      sum += bucket.average * bucket.count;
      total += bucket.count;
    }
  }
  return total > 0 ? sum / total : null;
}
