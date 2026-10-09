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
});
