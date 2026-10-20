import { describe, expect, it, vi } from "vitest";

import { startOfZonedDay, zonedDateKey } from "./dashboard-buckets";
import {
  DAY_MS,
  MIN_LEARNING_LOCK_MS,
  dueAtInCalendarDays,
  nextLearningSessionDueAt,
  scheduleNext,
  type MemorySchedule,
} from "./memory-scheduler";
import { getViewerTimeZone } from "./viewer-timezone";

const PACIFIC = "America/Los_Angeles";

/** Civil date plus `days`, using UTC so month/year rollover stays calendar-only. */
function addCivilDays(
  year: number,
  month: number,
  day: number,
  days: number,
): [number, number, number] {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return [utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate()];
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * UTC instant of local midnight for a civil date in `timeZone`.
 * Walks from noon UTC until the local date matches, then snaps.
 */
function startOfCalendarDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
): number {
  const key = dateKey(year, month, day);
  let probe = Date.UTC(year, month - 1, day, 12);
  for (let i = 0; i < 3; i += 1) {
    const found = zonedDateKey(probe, timeZone);
    if (found === key) return startOfZonedDay(probe, timeZone);
    probe += found < key ? DAY_MS : -DAY_MS;
  }
  throw new Error(`No local midnight for ${key} in ${timeZone}`);
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>();

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = clockFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    clockFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function localMinutes(timestamp: number, timeZone: string): number {
  const parts = clockFormatter(timeZone).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

function instantOnLocalClock(
  timeZone: string,
  dayStart: number,
  nextStart: number,
  hour: number,
  minute: number,
): number {
  const want = hour * 60 + minute;
  const minuteMs = 60 * 1000;
  let lo = 0;
  let hi = Math.floor((nextStart - dayStart - 1) / minuteMs);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localMinutes(dayStart + mid * minuteMs, timeZone) < want) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const ts = dayStart + lo * minuteMs;
  if (localMinutes(ts, timeZone) !== want) {
    throw new Error(`No local ${pad2(hour)}:${pad2(minute)} in ${timeZone}`);
  }
  return ts;
}

function reviewingAt(now: number): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    ease: 1,
    intervalDays: 2,
    dueAt: now,
    consecutiveCorrect: 1,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

describe("dueAtInCalendarDays across DST", () => {
  it("lands a 2-day exact across the Pacific fall-back at Monday midnight", () => {
    const now = Date.parse("2026-10-31T22:00:00.000Z"); // Sat Oct 31, 3 PM PDT
    const due = dueAtInCalendarDays(now, 2, 420, PACIFIC);
    expect(due).toBe(Date.parse("2026-11-02T08:00:00.000Z")); // Mon Nov 2, 00:00 PST
  });

  it("lands a 2-day exact across the Pacific spring-forward at Monday midnight", () => {
    const now = Date.parse("2026-03-07T23:00:00.000Z"); // Sat Mar 7, 3 PM PST
    const due = dueAtInCalendarDays(now, 2, 480, PACIFIC);
    expect(due).toBe(Date.parse("2026-03-09T07:00:00.000Z")); // Mon Mar 9, 00:00 PDT
  });

  it("keeps a 1-day review at 11:30 PM at least 6 hours out", () => {
    const dayStart = startOfCalendarDate(PACIFIC, 2026, 10, 30);
    const nextStart = startOfCalendarDate(PACIFIC, 2026, 10, 31);
    const now = instantOnLocalClock(PACIFIC, dayStart, nextStart, 23, 30);
    const due = dueAtInCalendarDays(now, 1, 420, PACIFIC);
    expect(due - now).toBeGreaterThanOrEqual(MIN_LEARNING_LOCK_MS);
    expect(due).toBe(now + MIN_LEARNING_LOCK_MS);
  });

  it("falls back to a rolling day when no zone info is sent", () => {
    const now = Date.parse("2026-10-31T22:00:00.000Z");
    expect(dueAtInCalendarDays(now, 2)).toBe(now + 2 * DAY_MS);
    expect(nextLearningSessionDueAt(now)).toBe(now + DAY_MS);
  });

  it("keeps the fixed-offset midnight when only tzOffsetMinutes is sent", () => {
    const now = Date.parse("2026-10-31T22:00:00.000Z");
    const offset = 420;
    const offsetMs = offset * 60 * 1000;
    const startOfLocalDay = Math.floor((now - offsetMs) / DAY_MS) * DAY_MS;
    const expected = startOfLocalDay + 2 * DAY_MS + offsetMs;
    expect(dueAtInCalendarDays(now, 2, offset)).toBe(expected);
    expect(new Date(expected).toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });

  it("uses the offset midnight when viewer zone resolution fails", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => {
        throw new Error("no zone");
      });
    const timeZone = getViewerTimeZone();
    resolvedOptions.mockRestore();

    expect(timeZone).toBeUndefined();

    const now = Date.parse("2026-10-31T22:00:00.000Z");
    const offset = 420;
    const offsetDue = dueAtInCalendarDays(now, 2, offset);
    const failedZoneDue = dueAtInCalendarDays(now, 2, offset, timeZone);
    const utcDue = dueAtInCalendarDays(now, 2, offset, "UTC");

    expect(failedZoneDue).toBe(offsetDue);
    expect(failedZoneDue).not.toBe(utcDue);
    expect(new Date(offsetDue).toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });

  it("schedules through scheduleNext when ReviewInput carries timeZone", () => {
    const now = Date.parse("2026-10-31T22:00:00.000Z");
    const next = scheduleNext(reviewingAt(now), {
      quality: "exact",
      accuracy: 100,
      mode: "review",
      now,
      tzOffsetMinutes: 420,
      timeZone: PACIFIC,
    });
    expect(next.dueAt).toBe(Date.parse("2026-11-02T08:00:00.000Z"));
  });
});

describe("dueAtInCalendarDays 2026 sweep", () => {
  const zones = [
    "America/Los_Angeles",
    "America/Adak",
    "Pacific/Auckland",
    "Australia/Lord_Howe",
    "UTC",
  ];
  const intervals = [1, 2, 3, 7, 30, 180, 365];
  const localTimes: Array<[number, number]> = [
    [0, 30],
    [9, 30],
    [13, 30],
    [15, 30],
    [23, 30],
  ];

  it.each(zones)(
    "hits local midnight of the target day in %s, except the 6-hour floor",
    (timeZone) => {
      const dayCount = 365 + 365;
      const starts: number[] = [];
      for (let dayOffset = 0; dayOffset < dayCount; dayOffset += 1) {
        const [year, month, day] = addCivilDays(2026, 1, 1, dayOffset);
        starts.push(startOfCalendarDate(timeZone, year, month, day));
      }
      const misses: string[] = [];
      for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
        const [year, month, day] = addCivilDays(2026, 1, 1, dayOffset);
        const dayStart = starts[dayOffset];
        const nextStart = starts[dayOffset + 1];
        if (dayStart === undefined || nextStart === undefined) {
          throw new Error("sweep midnight table is short");
        }
        for (const [hour, minute] of localTimes) {
          const now = instantOnLocalClock(
            timeZone,
            dayStart,
            nextStart,
            hour,
            minute,
          );
          const nowKey = zonedDateKey(now, timeZone);
          expect(nowKey).toBe(dateKey(year, month, day));
          for (const interval of intervals) {
            const due = dueAtInCalendarDays(now, interval, undefined, timeZone);
            const midnight = starts[dayOffset + interval];
            if (midnight === undefined) {
              throw new Error("sweep midnight table is short");
            }
            const expected = Math.max(midnight, now + MIN_LEARNING_LOCK_MS);
            if (due !== expected) {
              misses.push(
                `${timeZone} ${nowKey} ${pad2(hour)}:${pad2(minute)} +${interval}d → ${new Date(due).toISOString()} want ${new Date(expected).toISOString()}`,
              );
            }
          }
        }
      }
      expect(misses).toEqual([]);
    },
    20_000,
  );
});

describe("due-day midnight probe", () => {
  const zones = [
    "America/Los_Angeles",
    "America/Adak",
    "Pacific/Auckland",
    "Australia/Lord_Howe",
    "UTC",
  ];

  it("stays on the target calendar day for every 2026 interval through a year", () => {
    const misses: string[] = [];
    for (const timeZone of zones) {
      const dayCount = 365 + 365;
      const keys: string[] = [];
      const starts: number[] = [];
      for (let dayOffset = 0; dayOffset < dayCount; dayOffset += 1) {
        const [year, month, day] = addCivilDays(2026, 1, 1, dayOffset);
        keys.push(dateKey(year, month, day));
        starts.push(startOfCalendarDate(timeZone, year, month, day));
      }
      for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
        const startToday = starts[dayOffset];
        for (let interval = 1; interval <= 365; interval += 1) {
          const probe = startToday + interval * DAY_MS + DAY_MS / 2;
          const got = zonedDateKey(probe, timeZone);
          const want = keys[dayOffset + interval];
          if (got !== want) {
            misses.push(
              `${timeZone} ${keys[dayOffset]} +${interval}d probe ${got} want ${want}`,
            );
          }
        }
      }
    }
    expect(misses).toEqual([]);
  }, 20_000);
});
