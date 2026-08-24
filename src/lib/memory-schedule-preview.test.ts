import { describe, expect, it } from "vitest";

import { formatNextReviewPhrase } from "./memory-due-label";
import {
  EASE_START,
  scheduleNext,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";
import {
  memoryScheduleFromSnapshot,
  previewNextSchedule,
  type MemoryScheduleSnapshot,
} from "./memory-schedule-preview";

const NOW = 1_700_000_000_000;
const TZ = 420;

function reviewingSnapshot(
  overrides: Partial<MemoryScheduleSnapshot> = {},
): MemoryScheduleSnapshot {
  return {
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    dueAt: NOW,
    ease: EASE_START,
    intervalDays: 1,
    consecutiveCorrect: 1,
    lapses: 0,
    earlyReviewApplied: false,
    ...overrides,
  };
}

function reviewInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    quality: "exact",
    accuracy: 100,
    mode: "review",
    now: NOW,
    wordCount: 12,
    tzOffsetMinutes: TZ,
    ...overrides,
  };
}

describe("memoryScheduleFromSnapshot", () => {
  it("refuses to invent an interval for reviewing verses", () => {
    expect(
      memoryScheduleFromSnapshot(
        reviewingSnapshot({ intervalDays: undefined }),
      ),
    ).toBeNull();
  });

  it("hydrates learning verses without an interval", () => {
    const schedule = memoryScheduleFromSnapshot({
      status: "learning",
      learnStage: 1,
      stageReps: 2,
      dueAt: NOW,
    });
    expect(schedule).toMatchObject({
      status: "learning",
      intervalDays: 0,
      ease: EASE_START,
    });
  });
});

describe("previewNextSchedule", () => {
  it("matches scheduleNext for an exact review", () => {
    const snapshot = reviewingSnapshot();
    const input = reviewInput();
    const current = memoryScheduleFromSnapshot(snapshot) as MemorySchedule;
    expect(previewNextSchedule(snapshot, input)).toEqual(
      scheduleNext(current, input),
    );
  });

  it("shows a concrete due phrase immediately for a first reviewing interval", () => {
    const next = previewNextSchedule(reviewingSnapshot(), reviewInput());
    expect(next).not.toBeNull();
    const phrase = formatNextReviewPhrase(next, NOW);
    expect(phrase).toMatch(/^(due today|tomorrow|in \d+ days)$/);
  });

  it("does not guess a due phrase when the interval is missing", () => {
    expect(
      previewNextSchedule(
        reviewingSnapshot({ intervalDays: undefined }),
        reviewInput(),
      ),
    ).toBeNull();
  });
});
