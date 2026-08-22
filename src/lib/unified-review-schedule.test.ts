import { describe, expect, it } from "vitest";

import {
  EASE_START,
  MAX_LEARN_STAGE,
  scheduleNext,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";
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
});
