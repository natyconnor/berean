import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DAY_MS,
  isLearningLocked,
  MIN_LEARNING_LOCK_MS,
  nextLearningSessionDueAt,
} from "@/lib/memory-scheduler";

import {
  getSessionNow,
  resetSessionNowForTests,
  shouldAdvanceSessionNow,
  useLiveNow,
} from "./use-live-now";

const TZ = 420; // UTC-7

function localMidnightUtc(timestamp: number, tzOffsetMinutes: number): number {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  return Math.floor((timestamp - offsetMs) / DAY_MS) * DAY_MS + offsetMs;
}

describe("shouldAdvanceSessionNow", () => {
  it("stays frozen through a short tab switch on the same local day", () => {
    const nineAm = localMidnightUtc(1_700_000_000_000, TZ) + 9 * 60 * 60 * 1000;
    expect(shouldAdvanceSessionNow(nineAm, nineAm + 10 * 60 * 1000, TZ)).toBe(
      false,
    );
  });

  it("catches up when the local calendar day changes", () => {
    const nineAm = localMidnightUtc(1_700_000_000_000, TZ) + 9 * 60 * 60 * 1000;
    const nextMorning = nineAm + 23 * 60 * 60 * 1000;
    expect(shouldAdvanceSessionNow(nineAm, nextMorning, TZ)).toBe(true);
  });

  it("catches up after a 6-hour lock floor on the same local day", () => {
    const midnight = localMidnightUtc(1_700_000_000_000, TZ);
    expect(
      shouldAdvanceSessionNow(midnight, midnight + MIN_LEARNING_LOCK_MS, TZ),
    ).toBe(true);
  });

  it("does not catch up when the clock went backwards", () => {
    const nineAm = localMidnightUtc(1_700_000_000_000, TZ) + 9 * 60 * 60 * 1000;
    expect(shouldAdvanceSessionNow(nineAm, nineAm - 1, TZ)).toBe(false);
  });

  it("catches up across a spring-forward midnight before the 6-hour floor", () => {
    const standard = TZ + 60; // UTC-8
    const daylight = TZ; // UTC-7
    // 11:00 PM standard → 3:00 AM daylight is 3 real hours; the 2:00 hour is skipped.
    const elevenPm =
      localMidnightUtc(1_700_000_000_000, standard) + 23 * 60 * 60 * 1000;
    const threeAm = elevenPm + 3 * 60 * 60 * 1000;

    expect(threeAm - elevenPm).toBeLessThan(MIN_LEARNING_LOCK_MS);
    // The post-transition offset alone maps both instants onto the new day.
    expect(shouldAdvanceSessionNow(elevenPm, threeAm, daylight)).toBe(false);
    expect(shouldAdvanceSessionNow(elevenPm, threeAm, daylight, standard)).toBe(
      true,
    );
  });
});

describe("overnight learning lock vs session clock", () => {
  it("unlocks yesterday's Challenge once the clock catches up to this morning", () => {
    const yesterdayNine =
      localMidnightUtc(1_700_000_000_000, TZ) + 9 * 60 * 60 * 1000;
    const dueAt = nextLearningSessionDueAt(yesterdayNine, TZ);
    const thisMorning = dueAt + 8 * 60 * 60 * 1000;
    const schedule = {
      status: "learning" as const,
      dueAt,
      lastReviewedAt: yesterdayNine,
    };

    expect(isLearningLocked(schedule, yesterdayNine)).toBe(true);
    expect(shouldAdvanceSessionNow(yesterdayNine, thisMorning, TZ)).toBe(true);
    expect(isLearningLocked(schedule, thisMorning)).toBe(false);
  });
});

describe("useLiveNow", () => {
  afterEach(() => {
    resetSessionNowForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("catches up when the tab becomes visible on a new local day", () => {
    const start = Date.UTC(2026, 9, 7, 16, 0, 0); // 9am PDT
    vi.useFakeTimers();
    vi.setSystemTime(start);
    resetSessionNowForTests();

    const { result, unmount } = renderHook(() => useLiveNow());
    expect(result.current).toBe(start);
    expect(getSessionNow()).toBe(start);

    act(() => {
      vi.setSystemTime(start + DAY_MS);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(start + DAY_MS);
    unmount();
  });

  it("rechecks within a minute when a focused tab wakes on a new local day", () => {
    const start = Date.UTC(2026, 9, 7, 16, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(start);
    resetSessionNowForTests();

    let renders = 0;
    const { result, unmount } = renderHook(() => {
      renders += 1;
      return useLiveNow();
    });
    const rendersAfterMount = renders;
    expect(result.current).toBe(start);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(start);
    expect(renders).toBe(rendersAfterMount);

    act(() => {
      // Clock jumps across the missed midnight; pending timers keep their delay.
      vi.setSystemTime(start + DAY_MS);
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(start + DAY_MS + 60_000);
    expect(renders).toBe(rendersAfterMount + 1);
    unmount();
  });

  it("rechecks a spring-forward wake before the 6-hour floor", () => {
    const standard = 480;
    const daylight = 420;
    const elevenPm =
      localMidnightUtc(Date.UTC(2026, 2, 8), standard) + 23 * 60 * 60 * 1000;
    vi.useFakeTimers();
    vi.setSystemTime(elevenPm);
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockImplementation(function (
      this: Date,
    ) {
      return this.getTime() < elevenPm + 60 * 60 * 1000 ? standard : daylight;
    });
    resetSessionNowForTests();

    const { result, unmount } = renderHook(() => useLiveNow());
    expect(result.current).toBe(elevenPm);

    const threeAm = elevenPm + 3 * 60 * 60 * 1000;
    act(() => {
      vi.setSystemTime(threeAm);
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(threeAm + 60_000);
    expect(result.current - elevenPm).toBeLessThan(MIN_LEARNING_LOCK_MS);
    unmount();
  });

  it("stops the recheck interval when the last subscriber unmounts", () => {
    const start = Date.UTC(2026, 9, 7, 16, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(start);
    resetSessionNowForTests();

    const { unmount } = renderHook(() => useLiveNow());
    unmount();

    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.setSystemTime(start + DAY_MS);
      vi.advanceTimersByTime(60_000);
    });

    expect(getSessionNow()).toBe(start);
  });

  it("advances when the midnight timer fires with no visibility or focus events", () => {
    const probe = Date.UTC(2026, 5, 15, 12, 0, 0);
    const offset = new Date(probe).getTimezoneOffset();
    const elevenPm = localMidnightUtc(probe, offset) + 23 * 60 * 60 * 1000;
    vi.useFakeTimers();
    vi.setSystemTime(elevenPm);
    resetSessionNowForTests();

    const { result, unmount } = renderHook(() => useLiveNow());
    expect(result.current).toBe(elevenPm);

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(result.current).toBe(elevenPm + 60 * 60 * 1000);
    unmount();
  });

  it("schedules next midnight from the frozen instant's offset across spring-forward", () => {
    const standard = 480;
    const daylight = 420;
    const elevenPm =
      localMidnightUtc(Date.UTC(2026, 2, 8), standard) + 23 * 60 * 60 * 1000;
    vi.useFakeTimers();
    vi.setSystemTime(elevenPm);
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockImplementation(function (
      this: Date,
    ) {
      return this.getTime() < elevenPm + 60 * 60 * 1000 ? standard : daylight;
    });
    resetSessionNowForTests();

    const first = renderHook(() => useLiveNow());
    expect(first.result.current).toBe(elevenPm);
    first.unmount();

    const afterLockFloor = elevenPm + MIN_LEARNING_LOCK_MS + 60 * 60 * 1000;
    act(() => {
      vi.setSystemTime(afterLockFloor);
    });

    const { result, unmount } = renderHook(() => useLiveNow());
    expect(result.current).toBe(afterLockFloor);
    // The minute recheck is running. A current-offset midnight would still
    // be pending; the frozen calendar day has already passed both deadlines.
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });
});
