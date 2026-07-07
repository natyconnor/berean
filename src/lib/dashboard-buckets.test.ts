import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  bucketAccuracyAverages,
  bucketForecastCounts,
  bucketReviewCounts,
  computeStreak,
  overallAccuracy,
  startOfUtcDay,
  utcDayStarts,
} from "./dashboard-buckets";

// A fixed reference "now": 2024-01-10T12:34:56Z (mid-day so day rounding matters).
const NOW = Date.UTC(2024, 0, 10, 12, 34, 56);
const TODAY = Date.UTC(2024, 0, 10);

describe("startOfUtcDay", () => {
  it("floors a timestamp to midnight UTC", () => {
    expect(startOfUtcDay(NOW)).toBe(TODAY);
    expect(startOfUtcDay(TODAY)).toBe(TODAY);
  });
});

describe("utcDayStarts", () => {
  it("returns `days` day-starts ending today, oldest first", () => {
    const starts = utcDayStarts(NOW, 3);
    expect(starts).toEqual([TODAY - 2 * DAY_MS, TODAY - DAY_MS, TODAY]);
  });
});

describe("bucketReviewCounts", () => {
  it("counts timestamps per day and ignores out-of-window entries", () => {
    const counts = bucketReviewCounts(
      [
        NOW, // today
        TODAY, // today (midnight)
        TODAY - DAY_MS + 1000, // yesterday
        TODAY - 5 * DAY_MS, // outside a 3-day window
        NOW + DAY_MS, // future, outside window
      ],
      NOW,
      3,
    );
    // oldest first: [dayMinus2 = 0, yesterday = 1, today = 2]
    expect(counts).toEqual([0, 1, 2]);
  });
});

describe("bucketAccuracyAverages", () => {
  it("averages accuracy per day, null when empty", () => {
    const buckets = bucketAccuracyAverages(
      [
        { createdAt: NOW, accuracy: 100 },
        { createdAt: TODAY + 1000, accuracy: 80 },
        { createdAt: TODAY - DAY_MS, accuracy: 50 },
      ],
      NOW,
      3,
    );
    expect(buckets[0]).toEqual({ average: null, count: 0 });
    expect(buckets[1]).toEqual({ average: 50, count: 1 });
    expect(buckets[2]).toEqual({ average: 90, count: 2 });
  });
});

describe("bucketForecastCounts", () => {
  it("buckets upcoming dueAts and folds overdue into today", () => {
    const counts = bucketForecastCounts(
      [
        TODAY - 3 * DAY_MS, // overdue -> today
        NOW, // due now -> today
        TODAY + DAY_MS + 5000, // tomorrow
        TODAY + 2 * DAY_MS, // day after
        TODAY + 10 * DAY_MS, // outside 3-day window
      ],
      NOW,
      3,
    );
    expect(counts).toEqual([2, 1, 1]);
  });

  it("excludes verses due later today (dueAt > now) from the Today count", () => {
    const laterToday = NOW + 60 * 60 * 1000; // +1h, still the same UTC day
    expect(startOfUtcDay(laterToday)).toBe(TODAY);

    const counts = bucketForecastCounts(
      [
        NOW - 1000, // overdue -> today
        laterToday, // not yet due -> kept out of Today (no calendar bucket)
      ],
      NOW,
      3,
    );
    expect(counts).toEqual([1, 0, 0]);
  });
});

describe("computeStreak", () => {
  it("counts consecutive nonzero days ending today", () => {
    expect(computeStreak([1, 0, 2, 3, 4])).toBe(3);
  });

  it("is 0 when today has no reviews", () => {
    expect(computeStreak([5, 5, 0])).toBe(0);
  });

  it("is 0 for an empty window", () => {
    expect(computeStreak([0, 0, 0])).toBe(0);
  });
});

describe("overallAccuracy", () => {
  it("weights day averages by review count", () => {
    const value = overallAccuracy([
      { average: 90, count: 2 },
      { average: 60, count: 1 },
      { average: null, count: 0 },
    ]);
    expect(value).toBeCloseTo((90 * 2 + 60) / 3);
  });

  it("returns null with no reviews", () => {
    expect(overallAccuracy([{ average: null, count: 0 }])).toBeNull();
  });
});
