import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  EASE_START,
  LEARN_PROGRESS_ACCURACY,
  MAX_LEARN_STAGE,
  REVIEW_DAILY_INTERVAL_DAYS,
  REVIEW_EVERY_OTHER_INTERVAL_DAYS,
  dueAtInCalendarDays,
  initialSchedule,
  nextStartOverUndo,
  refreshSchedule,
  restoreStartOverUndo,
  scheduleNext,
  startOverSchedule,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";

const NOW = 1_700_000_000_000;

function review(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    quality: "exact",
    accuracy: 100,
    mode: "review",
    now: NOW,
    ...overrides,
  };
}

function reviewing(overrides: Partial<MemorySchedule> = {}): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 7,
    dueAt: NOW,
    consecutiveCorrect: 3,
    lapses: 1,
    earlyReviewApplied: false,
    ...overrides,
  };
}

function learning(overrides: Partial<MemorySchedule> = {}): MemorySchedule {
  return {
    status: "learning",
    learnStage: 2,
    stageReps: 1,
    ease: EASE_START,
    intervalDays: 0,
    dueAt: NOW + DAY_MS,
    consecutiveCorrect: 2,
    lapses: 0,
    earlyReviewApplied: false,
    ...overrides,
  };
}

describe("hinted review", () => {
  it("leaves status and gap unchanged and due tomorrow after a strong first-letters recall", () => {
    const prior = reviewing({ intervalDays: 7, ease: 2.1, lapses: 1 });
    const next = scheduleNext(
      prior,
      review({
        quality: "close",
        accuracy: LEARN_PROGRESS_ACCURACY,
        hint: "first-letters",
      }),
    );

    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(7);
    expect(next.ease).toBe(2.1);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe(dueAtInCalendarDays(NOW, 1));
  });

  it("does not count a strong hinted recall as a lapse", () => {
    const next = scheduleNext(
      reviewing({ lapses: 2 }),
      review({
        quality: "off",
        accuracy: 90,
        hint: "first-letters",
      }),
    );
    expect(next.lapses).toBe(2);
  });

  it("restores the kept interval without stretching on the next exact", () => {
    const prior = reviewing({ intervalDays: 7, ease: 2.1, lapses: 1 });
    const next = scheduleNext(
      prior,
      review({
        quality: "exact",
        accuracy: 100,
        priorHintedCheckIn: true,
      }),
    );

    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(7);
    expect(next.ease).toBe(2.1);
    expect(next.dueAt).toBe(dueAtInCalendarDays(NOW, 7));
  });

  it("grows normally on the exact after the restored check-in", () => {
    const restored = reviewing({
      intervalDays: 7,
      ease: 2.1,
      stageReps: 4,
    });
    const next = scheduleNext(restored, review({ quality: "exact" }));
    expect(next.intervalDays).toBeGreaterThan(7);
  });

  it("uses the normal one-rung lapse when a hinted recall is under 60%", () => {
    const prior = reviewing({ intervalDays: 7, lapses: 1, ease: EASE_START });
    const next = scheduleNext(
      prior,
      review({
        quality: "off",
        accuracy: 34,
        hint: "first-letters",
      }),
    );
    expect(next.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(next.lapses).toBe(2);
    expect(next.ease).toBeLessThan(EASE_START);
  });

  it("holds the gap when a hinted recall lands between 60% and 85%", () => {
    const prior = reviewing({ intervalDays: 7, lapses: 1 });
    const next = scheduleNext(
      prior,
      review({
        quality: "close",
        accuracy: 70,
        hint: "first-letters",
      }),
    );
    expect(next.intervalDays).toBe(7);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe(dueAtInCalendarDays(NOW, 7));
  });

  it("does not move the schedule when a practice hint is used", () => {
    const prior = reviewing({ intervalDays: 12, dueAt: NOW + DAY_MS });
    const next = scheduleNext(
      prior,
      review({
        mode: "practice",
        hint: "first-letters",
        accuracy: 96,
      }),
    );
    expect(next).toEqual(prior);
  });

  it("does not move the schedule when a refresher sitting holds it", () => {
    const prior = reviewing({ intervalDays: 12, lapses: 3 });
    const next = scheduleNext(
      prior,
      review({
        holdSchedule: true,
        accuracy: 40,
        quality: "off",
      }),
    );
    expect(next).toEqual(prior);
  });

  it("still due-tomorrows a hinted Guided learning pass", () => {
    const prior = learning({ learnStage: 1, stageReps: 0, dueAt: NOW });
    const next = scheduleNext(
      prior,
      review({
        mode: "learn",
        quality: "close",
        accuracy: LEARN_PROGRESS_ACCURACY,
        hint: "first-letters",
      }),
    );
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(0);
    expect(next.dueAt).toBe(dueAtInCalendarDays(NOW, 1));
  });

  it("leaves a hinted From memory learning pass unlocked with no progress", () => {
    const prior = learning({
      learnStage: MAX_LEARN_STAGE,
      stageReps: 0,
      dueAt: NOW,
    });
    const next = scheduleNext(
      prior,
      review({
        mode: "learn",
        quality: "close",
        accuracy: LEARN_PROGRESS_ACCURACY,
        hint: "first-letters",
      }),
    );
    expect(next).toEqual(prior);
  });

  it("banks a later unhinted From memory pass after a hinted one", () => {
    const prior = learning({
      learnStage: MAX_LEARN_STAGE,
      stageReps: 0,
      dueAt: NOW,
    });
    const afterHint = scheduleNext(
      prior,
      review({
        mode: "learn",
        quality: "close",
        accuracy: 92,
        hint: "first-letters",
      }),
    );
    const next = scheduleNext(
      afterHint,
      review({
        mode: "learn",
        quality: "close",
        accuracy: 92,
      }),
    );
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(1);
    expect(next.dueAt).toBe(NOW);
  });
});

describe("refreshSchedule", () => {
  it("drops a growing verse one rung to every other day", () => {
    const next = refreshSchedule(reviewing({ intervalDays: 12 }), {
      now: NOW,
      overdueMs: 3 * DAY_MS,
      recentLapseCount: 0,
    });
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(next.stageReps).toBe(0);
    expect(next.ease).toBe(EASE_START);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe(
      dueAtInCalendarDays(NOW, REVIEW_EVERY_OTHER_INTERVAL_DAYS),
    );
  });

  it("drops every-other-day to daily", () => {
    const next = refreshSchedule(
      reviewing({ intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS }),
      { now: NOW, overdueMs: 0, recentLapseCount: 0 },
    );
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
  });

  it("keeps a daily verse daily", () => {
    const next = refreshSchedule(
      reviewing({ intervalDays: REVIEW_DAILY_INTERVAL_DAYS }),
      { now: NOW, overdueMs: 0, recentLapseCount: 0 },
    );
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.status).toBe("reviewing");
  });

  it("puts a badly overdue verse on the daily rung", () => {
    const next = refreshSchedule(reviewing({ intervalDays: 10 }), {
      now: NOW,
      overdueMs: 20 * DAY_MS,
      recentLapseCount: 0,
    });
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(0);
  });

  it("puts a twice-lapsed verse on the daily rung", () => {
    const next = refreshSchedule(reviewing({ intervalDays: 24 }), {
      now: NOW,
      overdueMs: 0,
      recentLapseCount: 2,
    });
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
  });

  it("turns Mastered into Memorized when the gap falls under 30 days", () => {
    const next = refreshSchedule(
      reviewing({ status: "mastered", intervalDays: 30 }),
      { now: NOW, overdueMs: 0, recentLapseCount: 0 },
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
  });

  it("steps a learning verse back one band and clears the soft lock", () => {
    const next = refreshSchedule(learning(), {
      now: NOW,
      overdueMs: 0,
      recentLapseCount: 0,
    });
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(0);
    expect(next.dueAt).toBe(NOW);
  });

  it("does not step a Read verse below Read", () => {
    const next = refreshSchedule(learning({ learnStage: 0, stageReps: 0 }), {
      now: NOW,
      overdueMs: 0,
      recentLapseCount: 0,
    });
    expect(next.learnStage).toBe(0);
    expect(next.dueAt).toBe(NOW);
  });
});

describe("start over and undo", () => {
  it("returns a verse to new Read with a fresh ease and due now", () => {
    const next = startOverSchedule(NOW);
    expect(next).toEqual(initialSchedule(NOW));
    expect(next.status).toBe("new");
    expect(next.learnStage).toBe(0);
    expect(next.stageReps).toBe(0);
    expect(next.intervalDays).toBe(0);
    expect(next.ease).toBe(EASE_START);
    expect(next.consecutiveCorrect).toBe(0);
    expect(next.lapses).toBe(0);
    expect(next.earlyReviewApplied).toBe(false);
    expect(next.dueAt).toBe(NOW);
  });

  it("restores the exact prior schedule on undo", () => {
    const prior = reviewing({
      intervalDays: 24,
      ease: 2.1,
      lapses: 1,
      consecutiveCorrect: 5,
      stageReps: 0,
      dueAt: NOW - 3 * DAY_MS,
    });
    const reset = startOverSchedule(NOW);
    expect(reset.status).toBe("new");
    expect(restoreStartOverUndo(prior)).toEqual(prior);
  });

  it("drops lastReviewedAt from a reviewed-verse snapshot so undo can return a schedule", () => {
    const prior = reviewing({
      intervalDays: 24,
      ease: 2.1,
      lapses: 1,
      consecutiveCorrect: 5,
      dueAt: NOW - 3 * DAY_MS,
    });
    const restored = restoreStartOverUndo({
      ...prior,
      lastReviewedAt: NOW - 10 * DAY_MS,
    });
    expect(restored).toEqual(prior);
    expect(restored).not.toHaveProperty("lastReviewedAt");
  });

  it("keeps the live snapshot and replaces it once Undo is gone", () => {
    const first = reviewing({ intervalDays: 40, dueAt: NOW - DAY_MS });
    const later = startOverSchedule(NOW);
    expect(nextStartOverUndo(undefined, first, true)).toEqual(first);
    expect(nextStartOverUndo(first, later, false)).toBe(first);
    expect(nextStartOverUndo(first, later, true)).toBe(later);
  });
});
