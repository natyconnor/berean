/**
 * Pure day-bucketing helpers for the Study progress dashboard.
 *
 * These functions turn flat lists of timestamps (review `createdAt`s, verse
 * `dueAt`s) into fixed-length per-day arrays the dashboard charts consume.
 * They are intentionally framework-free (no Convex, no React) so they are
 * trivially unit-testable and shared between the Convex aggregate queries and
 * any client-side derivation.
 *
 * **Timezone.** Convex queries cannot call `Date.now()` or read the viewer's
 * zone, so the client passes `now` plus an IANA `timeZone` (e.g.
 * `America/Los_Angeles`). Day boundaries are local midnights in that zone,
 * including DST transitions — never UTC midnight.
 */

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dateKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateKeyFormatters.get(timeZone);
  if (!formatter) {
    // en-CA yields stable YYYY-MM-DD keys that sort lexicographically by date.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateKeyFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Fall back to UTC when the zone string is missing or rejected by Intl. */
export function normalizeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** Calendar `YYYY-MM-DD` for `ts` in `timeZone`. */
export function zonedDateKey(ts: number, timeZone: string): string {
  return dateKeyFormatter(timeZone).format(new Date(ts));
}

/**
 * UTC instant of local midnight for the calendar day containing `ts` in
 * `timeZone`. Binary-searches across the ±14h window around the UTC date so
 * DST gaps/overlaps still resolve to the true local midnight.
 */
export function startOfZonedDay(ts: number, timeZone: string): number {
  const key = zonedDateKey(ts, timeZone);
  const [year, month, day] = key.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  let lo = utcGuess - 14 * HOUR_MS;
  let hi = utcGuess + 14 * HOUR_MS;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (zonedDateKey(mid, timeZone) < key) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** @deprecated Prefer {@link startOfZonedDay} with an explicit zone. */
export function startOfUtcDay(ts: number): number {
  return startOfZonedDay(ts, "UTC");
}

/**
 * `days` local-midnight timestamps ending on the local day of `now`, oldest
 * first. The last entry is always "today" in `timeZone`.
 */
export function zonedDayStarts(
  now: number,
  days: number,
  timeZone: string,
): number[] {
  const starts: number[] = [startOfZonedDay(now, timeZone)];
  for (let i = 1; i < days; i += 1) {
    // Step 1ms before this midnight so we land on the previous calendar day
    // (including 23h/25h DST days). Do not subtract ~36h from midnight — that
    // skips a day.
    const previous = starts[0];
    starts.unshift(startOfZonedDay(previous - 1, timeZone));
  }
  return starts;
}

/** @deprecated Prefer {@link zonedDayStarts}. */
export function utcDayStarts(now: number, days: number): number[] {
  return zonedDayStarts(now, days, "UTC");
}

/**
 * `days` local-midnight timestamps starting on the local day of `now`, oldest
 * first (today, tomorrow, …). Used by the review forecast.
 */
export function zonedUpcomingDayStarts(
  now: number,
  days: number,
  timeZone: string,
): number[] {
  const starts: number[] = [startOfZonedDay(now, timeZone)];
  for (let i = 1; i < days; i += 1) {
    const previous = starts[i - 1];
    starts.push(startOfZonedDay(previous + 36 * HOUR_MS, timeZone));
  }
  return starts;
}

function dayKeyIndex(
  starts: readonly number[],
  timeZone: string,
): Map<string, number> {
  const map = new Map<string, number>();
  starts.forEach((dayStart, i) => {
    map.set(zonedDateKey(dayStart, timeZone), i);
  });
  return map;
}

/**
 * Count timestamps into a `days`-long window ending today (local), oldest
 * first. Timestamps outside the window are ignored.
 */
export function bucketReviewCounts(
  createdAts: readonly number[],
  now: number,
  days: number,
  timeZone: string = "UTC",
): number[] {
  const starts = zonedDayStarts(now, days, timeZone);
  const indexByKey = dayKeyIndex(starts, timeZone);
  const counts = Array.from({ length: days }, () => 0);
  for (const ts of createdAts) {
    const index = indexByKey.get(zonedDateKey(ts, timeZone));
    if (index !== undefined) {
      counts[index] += 1;
    }
  }
  return counts;
}

/**
 * Average `accuracy` per local day over a `days`-long window ending today,
 * oldest first. Days with no reviews get `null` (rather than 0) so charts can
 * skip them instead of drawing a misleading zero.
 */
export function bucketAccuracyAverages(
  reviews: readonly { createdAt: number; accuracy: number }[],
  now: number,
  days: number,
  timeZone: string = "UTC",
): Array<{ average: number | null; count: number }> {
  const starts = zonedDayStarts(now, days, timeZone);
  const indexByKey = dayKeyIndex(starts, timeZone);
  const sums = Array.from({ length: days }, () => 0);
  const counts = Array.from({ length: days }, () => 0);
  for (const review of reviews) {
    const index = indexByKey.get(zonedDateKey(review.createdAt, timeZone));
    if (index !== undefined) {
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
 * Count verse `dueAt`s into the next `days` local days starting today, oldest
 * first. Day 0 ("Today") counts only verses that are **actually due now**
 * (`dueAt <= now`), matching the rest of the app's "due today" definition
 * (`memoryStats.due`, `dueQueue`, the Start review disabled state) — so
 * overdue verses fold into Today but a verse scheduled for later today does
 * not. Callers must pass only review-phase (`reviewing` / `mastered`) dueAts;
 * learning-phase verses are filtered out before this helper runs.
 * Upcoming days (1..) are bucketed by local calendar day; verses due later
 * today therefore fall outside the window's day-0 count and are not shown.
 * Verses due beyond the window are ignored.
 */
export function bucketForecastCounts(
  dueAts: readonly number[],
  now: number,
  days: number,
  timeZone: string = "UTC",
): number[] {
  const starts = zonedUpcomingDayStarts(now, days, timeZone);
  const indexByKey = dayKeyIndex(starts, timeZone);
  const counts = Array.from({ length: days }, () => 0);
  for (const dueAt of dueAts) {
    if (dueAt <= now) {
      // Due or overdue -> Today, consistent with `dueAt <= now` everywhere.
      counts[0] += 1;
      continue;
    }
    // Not yet due: bucket into its upcoming local calendar day. An index of 0
    // here means "later today" — kept out of the Today count (no calendar
    // bucket fits it) rather than inflating the "due now" number.
    const index = indexByKey.get(zonedDateKey(dueAt, timeZone));
    if (index !== undefined && index >= 1) {
      counts[index] += 1;
    }
  }
  return counts;
}

/**
 * Streak derived from oldest-first daily activity counts
 * ({@link bucketReviewCounts}).
 *
 * - If today has activity, `days` is the run ending today and `atRisk` is false.
 * - If today is empty but yesterday starts a run, that run is still alive
 *   (`atRisk: true`) — the user must practice today to extend it.
 * - Otherwise the streak is broken (`days: 0`).
 */
export interface StreakInfo {
  days: number;
  /** True when a streak ending yesterday is waiting on today's practice. */
  atRisk: boolean;
}

export function computeStreak(dailyCounts: readonly number[]): StreakInfo {
  if (dailyCounts.length === 0) {
    return { days: 0, atRisk: false };
  }

  const todayIndex = dailyCounts.length - 1;
  const practicedToday = (dailyCounts[todayIndex] ?? 0) > 0;

  // Grace for "new day, not yet practiced": count from yesterday if it has activity.
  let startIndex = todayIndex;
  if (!practicedToday) {
    if (todayIndex === 0 || (dailyCounts[todayIndex - 1] ?? 0) === 0) {
      return { days: 0, atRisk: false };
    }
    startIndex = todayIndex - 1;
  }

  let days = 0;
  for (let i = startIndex; i >= 0; i -= 1) {
    if ((dailyCounts[i] ?? 0) > 0) {
      days += 1;
    } else {
      break;
    }
  }

  return { days, atRisk: !practicedToday && days > 0 };
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
