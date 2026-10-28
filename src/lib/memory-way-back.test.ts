import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  EASE_START,
  MAX_LEARN_STAGE,
  REVIEW_DAILY_INTERVAL_DAYS,
  REVIEW_LAPSE_LEARN_STAGE,
  dueAtInCalendarDays,
  type MemorySchedule,
} from "./memory-scheduler";
import {
  modeToStore,
  planRefreshFinish,
  planRescueSpend,
  refreshEligibility,
  refreshStepGate,
  verseRefreshEligibility,
} from "./memory-way-back";

const NOW = 1_700_000_000_000;

function reviewing(overrides: Partial<MemorySchedule> = {}): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
    dueAt: NOW,
    consecutiveCorrect: 1,
    lapses: 1,
    earlyReviewApplied: false,
    ...overrides,
  };
}

function challenge(): MemorySchedule {
  return {
    status: "learning",
    learnStage: REVIEW_LAPSE_LEARN_STAGE,
    stageReps: 0,
    ease: 2.1,
    intervalDays: 0,
    dueAt: NOW,
    consecutiveCorrect: 0,
    lapses: 2,
    earlyReviewApplied: false,
  };
}

describe("verseRefreshEligibility", () => {
  it("hides Refresh on New and Read and keeps it on First letters", () => {
    expect(verseRefreshEligibility({ status: "new", learnStage: 0 })).toBe(
      "new-or-read",
    );
    expect(verseRefreshEligibility({ status: "learning", learnStage: 0 })).toBe(
      "new-or-read",
    );
    expect(
      verseRefreshEligibility({ status: "reviewing", learnStage: 0 }),
    ).toBe("new-or-read");
    expect(verseRefreshEligibility({ status: "learning", learnStage: 1 })).toBe(
      "learned",
    );
    expect(verseRefreshEligibility({ status: "learning", learnStage: 2 })).toBe(
      "learned",
    );
  });

  it("hides Refresh on an empty pack and shows it once a piece is past Read", () => {
    expect(refreshEligibility({ scope: "group", verses: [], pieces: [] })).toBe(
      "new-or-read",
    );
    expect(
      refreshEligibility({
        scope: "group",
        verses: [{ status: "new", learnStage: 0 }],
        pieces: [{ attachment: "learning", learnStage: 0 }],
      }),
    ).toBe("new-or-read");
    expect(
      refreshEligibility({
        scope: "group",
        verses: [],
        pieces: [{ attachment: "learning", learnStage: 1 }],
      }),
    ).toBe("learned");
    expect(
      refreshEligibility({
        scope: "group",
        verses: [],
        pieces: [{ attachment: "solid", learnStage: 0 }],
      }),
    ).toBe("learned");
  });
});

describe("spendDailyRescue", () => {
  it("restores a daily Challenge verse and a second call is already spent", () => {
    const first = planRescueSpend({
      schedule: challenge(),
      recent: [{ mode: "review", accuracy: 40 }],
      now: NOW,
    });
    expect(first.status).toBe("restore-daily");
    if (first.status !== "restore-daily") return;
    expect(first.sessionSpent).toBe(true);
    expect(first.schedule.status).toBe("reviewing");
    expect(first.schedule.learnStage).toBe(MAX_LEARN_STAGE);
    expect(first.schedule.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(first.schedule.dueAt).toBe(dueAtInCalendarDays(NOW, 1));
    expect(first.schedule.ease).toBe(2.1);
    expect(first.schedule.lapses).toBe(2);

    const second = planRescueSpend({
      schedule: first.schedule,
      recent: [{ mode: "review", accuracy: 40 }],
      now: NOW,
    });
    expect(second).toEqual({ status: "unchanged", sessionSpent: true });
  });

  it("does not restore a learn-mode miss", () => {
    const plan = planRescueSpend({
      schedule: challenge(),
      recent: [{ mode: "learn", accuracy: 20 }],
      now: NOW,
    });
    expect(plan).toEqual({ status: "unchanged", sessionSpent: false });
  });

  it("leaves a longer lapse that is already due later", () => {
    const later = reviewing({
      intervalDays: 2,
      dueAt: NOW + DAY_MS,
      lapses: 3,
    });
    const plan = planRescueSpend({
      schedule: later,
      recent: [{ mode: "review", accuracy: 10 }],
      now: NOW,
    });
    expect(plan).toEqual({ status: "unchanged", sessionSpent: true });
  });
});

describe("modeToStore", () => {
  it("stores a due unhinted practice that moved the schedule as a review", () => {
    expect(
      modeToStore({
        requestedMode: "practice",
        wasDueForReview: true,
        scheduleChanged: true,
      }),
    ).toBe("review");
  });

  it("leaves extra practice, hinted practice, and a held try as practice", () => {
    expect(
      modeToStore({
        requestedMode: "practice",
        wasDueForReview: false,
        scheduleChanged: true,
      }),
    ).toBe("practice");
    expect(
      modeToStore({
        requestedMode: "practice",
        hint: "first-letters",
        wasDueForReview: true,
        scheduleChanged: false,
      }),
    ).toBe("practice");
    expect(
      modeToStore({
        requestedMode: "practice",
        holdSchedule: true,
        wasDueForReview: true,
        scheduleChanged: false,
      }),
    ).toBe("practice");
    expect(
      modeToStore({
        requestedMode: "practice",
        wasDueForReview: true,
        scheduleChanged: false,
      }),
    ).toBe("practice");
  });
});

describe("refreshStepGate", () => {
  it("retries an early miss and finishes a weak From memory pass", () => {
    expect(refreshStepGate(1, { accuracy: 40, quality: "off" })).toEqual({
      type: "retry",
    });
    expect(refreshStepGate(2, { accuracy: 90, quality: "close" })).toEqual({
      type: "advance",
      next: 3,
    });
    expect(refreshStepGate(3, { accuracy: 40, quality: "off" })).toEqual({
      type: "weak-final",
    });
    expect(refreshStepGate(3, { accuracy: 90, quality: "close" })).toEqual({
      type: "passed-final",
    });
  });
});

describe("planRefreshFinish stamp", () => {
  it("is a no-op when the same sitting already applied", () => {
    const plan = planRefreshFinish(
      {
        kind: "verse",
        schedule: reviewing(),
        rows: [
          {
            createdAt: NOW,
            accuracy: 100,
            quality: "exact",
            holdSchedule: true,
            stage: 3,
          },
        ],
        appliedSittingAt: NOW,
      },
      {
        sittingStartedAt: NOW,
        now: NOW,
        overdueMs: 0,
        recentLapseCount: 0,
      },
    );
    expect(plan).toEqual({ status: "already-applied" });
  });

  it("leaves solid pieces put and still stamps a building finish", () => {
    const pieces = [
      {
        attachment: "solid" as const,
        learnStage: 3,
        stageReps: 0,
        dueAt: NOW - DAY_MS,
      },
      {
        attachment: "learning" as const,
        learnStage: 2,
        stageReps: 1,
        dueAt: NOW,
      },
    ];
    const plan = planRefreshFinish(
      {
        kind: "passage-building",
        pieces,
        rows: [
          {
            createdAt: NOW,
            accuracy: 40,
            quality: "off",
            holdSchedule: true,
          },
        ],
      },
      {
        sittingStartedAt: NOW,
        now: NOW,
        overdueMs: 0,
        recentLapseCount: 0,
      },
    );
    expect(plan.status).toBe("apply-pieces");
    if (plan.status !== "apply-pieces") return;
    expect(plan.outcome).toBe("rung-down");
    expect(plan.pieces).toEqual(pieces);
    expect(plan.appliedSittingAt).toBe(NOW);
  });
});
