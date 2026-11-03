import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  EASE_START,
  MAX_LEARN_STAGE,
  REVIEW_DAILY_INTERVAL_DAYS,
  REVIEW_LAPSE_LEARN_STAGE,
  scheduleNext,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";
import { memoryProgressFraction } from "./mastery-ring";
import {
  applyUnifiedGrade,
  canonicalUnifiedSchedule,
} from "./unified-review-schedule";

const NOW = 1_700_000_000_000;

function reviewing(overrides: Partial<MemorySchedule> = {}): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 5,
    dueAt: NOW + 3 * 86_400_000,
    consecutiveCorrect: 3,
    lapses: 0,
    earlyReviewApplied: true,
    ...overrides,
  };
}

function reviewInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    quality: "exact",
    accuracy: 100,
    mode: "review",
    now: NOW,
    wordCount: 40,
    ...overrides,
  };
}

describe("canonicalUnifiedSchedule", () => {
  it("picks the smallest intervalDays among mixed members", () => {
    const tight = reviewing({
      intervalDays: 2,
      ease: 2.5,
      consecutiveCorrect: 1,
      status: "reviewing",
    });
    const loose = reviewing({
      intervalDays: 12,
      ease: 1.4,
      lapses: 4,
      status: "mastered",
    });

    expect(canonicalUnifiedSchedule([loose, tight], NOW)).toEqual({
      status: tight.status,
      learnStage: tight.learnStage,
      stageReps: tight.stageReps,
      ease: tight.ease,
      intervalDays: 2,
      consecutiveCorrect: tight.consecutiveCorrect,
      lapses: tight.lapses,
      dueAt: NOW,
      earlyReviewApplied: false,
    });
  });

  it("breaks interval ties with lowest ease, then highest lapses", () => {
    const highEase = reviewing({ intervalDays: 4, ease: 2.6, lapses: 9 });
    const lowEase = reviewing({ intervalDays: 4, ease: 1.5, lapses: 0 });
    expect(canonicalUnifiedSchedule([highEase, lowEase], NOW).ease).toBe(1.5);

    const fewerLapses = reviewing({ intervalDays: 4, ease: 2.0, lapses: 1 });
    const moreLapses = reviewing({ intervalDays: 4, ease: 2.0, lapses: 5 });
    expect(
      canonicalUnifiedSchedule([fewerLapses, moreLapses], NOW).lapses,
    ).toBe(5);
  });

  it("sets dueAt to now and clears earlyReviewApplied", () => {
    const member = reviewing({
      dueAt: NOW + 10_000,
      earlyReviewApplied: true,
    });
    const canonical = canonicalUnifiedSchedule([member], NOW);
    expect(canonical.dueAt).toBe(NOW);
    expect(canonical.earlyReviewApplied).toBe(false);
  });

  it("throws when any member is still learning or new", () => {
    const learning: MemorySchedule = {
      status: "learning",
      learnStage: 1,
      stageReps: 0,
      ease: EASE_START,
      intervalDays: 0,
      dueAt: NOW,
      consecutiveCorrect: 0,
      lapses: 0,
      earlyReviewApplied: false,
    };
    expect(() =>
      canonicalUnifiedSchedule([reviewing(), learning], NOW),
    ).toThrow(/review phase/);
    expect(() => canonicalUnifiedSchedule([], NOW)).toThrow(
      /at least one member/,
    );
  });
});

describe("applyUnifiedGrade", () => {
  it("returns scheduleNext of the canonical review input", () => {
    const canonical = canonicalUnifiedSchedule(
      [reviewing({ intervalDays: 3 }), reviewing({ intervalDays: 8 })],
      NOW,
    );
    const input = reviewInput({ quality: "close", accuracy: 82 });
    expect(applyUnifiedGrade(canonical, input)).toEqual(
      scheduleNext(canonical, input),
    );
  });

  it("loses one banked review on a pack verse close miss", () => {
    const canonical = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      stageReps: 2,
      consecutiveCorrect: 2,
      lapses: 1,
      dueAt: NOW,
    });
    const next = applyUnifiedGrade(
      canonical,
      reviewInput({ quality: "close", accuracy: 70 }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(1);
    expect(next.consecutiveCorrect).toBe(1);
    expect(next.ease).toBeCloseTo(EASE_START, 5);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
    expect(
      memoryProgressFraction(
        next.status,
        next.learnStage,
        next.stageReps,
        next.intervalDays,
        undefined,
        next.ease,
      ),
    ).toBeGreaterThan(0);
    expect(next).toEqual(
      scheduleNext(canonical, reviewInput({ quality: "close", accuracy: 70 })),
    );
  });

  it("drops a pack verse to Learning on a bad miss with too few reviews", () => {
    const canonical = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      stageReps: 1,
      consecutiveCorrect: 1,
      lapses: 0,
      dueAt: NOW,
    });
    const next = applyUnifiedGrade(
      canonical,
      reviewInput({ quality: "off", accuracy: 40 }),
    );
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(REVIEW_LAPSE_LEARN_STAGE);
    expect(next.intervalDays).toBe(0);
    expect(next.stageReps).toBe(0);
    expect(next.dueAt).toBe(NOW);
    expect(next.lapses).toBe(1);
    expect(next.ease).toBeCloseTo(EASE_START - 0.2, 5);
    expect(next).toEqual(
      scheduleNext(canonical, reviewInput({ quality: "off", accuracy: 40 })),
    );
  });

  it("keeps a pack verse reviewing when a bad miss still has three reviews", () => {
    const canonical = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      stageReps: 3,
      consecutiveCorrect: 3,
      lapses: 2,
      dueAt: NOW,
    });
    const next = applyUnifiedGrade(
      canonical,
      reviewInput({ quality: "off", accuracy: 20 }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(0);
    expect(next.lapses).toBe(3);
    expect(next.ease).toBeCloseTo(EASE_START, 5);
    expect(next.dueAt).toBe(NOW + DAY_MS);
    expect(
      memoryProgressFraction(
        next.status,
        next.learnStage,
        next.stageReps,
        next.intervalDays,
        undefined,
        next.ease,
      ),
    ).toBe(0);
  });
});
