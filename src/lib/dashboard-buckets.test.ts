import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  bucketAccuracyAverages,
  bucketForecastCounts,
  bucketReviewCounts,
  computeStreak,
  normalizeTimeZone,
  overallAccuracy,
  startOfUtcDay,
  startOfZonedDay,
  utcDayStarts,
  zonedDateKey,
  zonedDayStarts,
} from "./dashboard-buckets";

// A fixed reference "now": 2024-01-10T12:34:56Z (mid-day so day rounding matters).
const NOW = Date.UTC(2024, 0, 10, 12, 34, 56);
const TODAY = Date.UTC(2024, 0, 10);

describe("normalizeTimeZone", () => {
  it("keeps valid IANA zones and falls back for junk", () => {
    expect(normalizeTimeZone("America/Los_Angeles")).toBe(
      "America/Los_Angeles",
    );
    expect(normalizeTimeZone("Not/AZone")).toBe("UTC");
    expect(normalizeTimeZone(undefined)).toBe("UTC");
  });
});

describe("startOfUtcDay", () => {
  it("floors a timestamp to midnight UTC", () => {
    expect(startOfUtcDay(NOW)).toBe(TODAY);
    expect(startOfUtcDay(TODAY)).toBe(TODAY);
  });
});

describe("utcDayStarts / zonedDayStarts", () => {
  it("returns `days` day-starts ending today, oldest first (UTC)", () => {
    const starts = utcDayStarts(NOW, 3);
    expect(starts).toEqual([TODAY - 2 * DAY_MS, TODAY - DAY_MS, TODAY]);
    expect(zonedDayStarts(NOW, 3, "UTC")).toEqual(starts);
  });
});

describe("startOfZonedDay / local Pacific evenings", () => {
  // Saturday 2026-07-11 21:15 PDT = Sunday 2026-07-12 04:15 UTC
  const saturdayEveningPdt = Date.parse("2026-07-12T04:15:00.000Z");
  const pacific = "America/Los_Angeles";

  it("keeps Saturday evening Pacific on Saturday, not Sunday UTC", () => {
    expect(zonedDateKey(saturdayEveningPdt, pacific)).toBe("2026-07-11");
    expect(zonedDateKey(saturdayEveningPdt, "UTC")).toBe("2026-07-12");

    const localStart = startOfZonedDay(saturdayEveningPdt, pacific);
    expect(zonedDateKey(localStart, pacific)).toBe("2026-07-11");
    // PDT is UTC-7 → local midnight = 07:00Z
    expect(localStart).toBe(Date.parse("2026-07-11T07:00:00.000Z"));
  });

  it("ends the heatmap window on local today, not UTC today", () => {
    const starts = zonedDayStarts(saturdayEveningPdt, 3, pacific);
    expect(starts.map((s) => zonedDateKey(s, pacific))).toEqual([
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
    ]);
  });

  it("buckets a Friday Pacific review onto Friday when UTC has rolled to Sunday", () => {
    // Friday 2026-07-10 20:00 PDT = Saturday 2026-07-11 03:00 UTC
    const fridayEveningPdt = Date.parse("2026-07-11T03:00:00.000Z");
    const counts = bucketReviewCounts(
      [fridayEveningPdt],
      saturdayEveningPdt,
      3,
      pacific,
    );
    // [Thu, Fri, Sat] — activity on Friday
    expect(counts).toEqual([0, 1, 0]);
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
    expect(computeStreak([1, 0, 2, 3, 4])).toEqual({
      days: 3,
      atRisk: false,
    });
  });

  it("keeps yesterday's streak alive when today is empty", () => {
    expect(computeStreak([5, 5, 0])).toEqual({ days: 2, atRisk: true });
  });

  it("is broken when yesterday and today are both empty", () => {
    expect(computeStreak([5, 0, 0])).toEqual({ days: 0, atRisk: false });
  });

  it("is 0 for an empty window", () => {
    expect(computeStreak([0, 0, 0])).toEqual({ days: 0, atRisk: false });
  });

  it("is not at risk when today has activity", () => {
    expect(computeStreak([0, 1, 2])).toEqual({ days: 2, atRisk: false });
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
