import { describe, expect, it } from "vitest";

import { DAY_MS, LEARN_PROGRESS_ACCURACY } from "./memory-scheduler";
import {
  isReviewHintedCheckIn,
  isShakyVerse,
  isStaleVerse,
  refreshRecentLapseCount,
  type RecentReview,
} from "./memory-stale";

const NOW = 1_700_000_000_000;

function lapse(accuracy = 34): RecentReview {
  return { accuracy, lapsed: true };
}

function hold(accuracy = 72): RecentReview {
  return { accuracy, lapsed: false };
}

describe("isStaleVerse", () => {
  it("is stale when a reviewing verse is overdue by at least a week", () => {
    expect(
      isStaleVerse({
        status: "reviewing",
        dueAt: NOW - 8 * DAY_MS,
        intervalDays: 2,
        now: NOW,
        lastReviews: [hold(), hold()],
      }),
    ).toBe(true);
  });

  it("is stale when overdue by its own interval if that gap is longer than a week", () => {
    expect(
      isStaleVerse({
        status: "reviewing",
        dueAt: NOW - 21 * DAY_MS,
        intervalDays: 7,
        now: NOW,
        lastReviews: [hold()],
      }),
    ).toBe(true);
  });

  it("is not stale when a reviewing verse is only a little overdue", () => {
    expect(
      isStaleVerse({
        status: "reviewing",
        dueAt: NOW - 2 * DAY_MS,
        intervalDays: 7,
        now: NOW,
        lastReviews: [hold(), hold(), hold()],
      }),
    ).toBe(false);
  });

  it("is stale after two lapses in the last three reviews", () => {
    expect(
      isStaleVerse({
        status: "mastered",
        dueAt: NOW,
        intervalDays: 30,
        now: NOW,
        lastReviews: [lapse(), hold(), lapse()],
      }),
    ).toBe(true);
  });

  it("is stale when a learning verse has sat mid-ladder for a week", () => {
    expect(
      isStaleVerse({
        status: "learning",
        dueAt: NOW,
        intervalDays: 0,
        lastReviewedAt: NOW - 7 * DAY_MS,
        learnStage: 2,
        now: NOW,
        lastReviews: [],
      }),
    ).toBe(true);
  });

  it("is not stale for a fresh unused verse", () => {
    expect(
      isStaleVerse({
        status: "new",
        dueAt: NOW,
        intervalDays: 0,
        now: NOW,
        lastReviews: [],
      }),
    ).toBe(false);
  });

  it("ignores misses from before the latest Start over", () => {
    expect(
      isStaleVerse({
        status: "learning",
        dueAt: NOW,
        intervalDays: 0,
        lastReviewedAt: NOW - 14 * DAY_MS,
        learnStage: 0,
        now: NOW,
        startedOverAt: NOW - 60_000,
        lastReviews: [
          { ...lapse(), createdAt: NOW - 10 * DAY_MS },
          { ...lapse(), createdAt: NOW - 8 * DAY_MS },
          { ...hold(), createdAt: NOW - 7 * DAY_MS },
        ],
      }),
    ).toBe(false);
  });
});

describe("isReviewHintedCheckIn", () => {
  const hinted = {
    hint: "first-letters" as const,
    accuracy: LEARN_PROGRESS_ACCURACY,
    mode: "review" as const,
  };

  it("counts only a review-mode hinted check-in", () => {
    expect(isReviewHintedCheckIn(hinted)).toBe(true);
  });

  it("ignores practice and held-schedule hinted tries", () => {
    expect(isReviewHintedCheckIn({ ...hinted, mode: "practice" })).toBe(false);
    expect(isReviewHintedCheckIn({ ...hinted, holdSchedule: true })).toBe(
      false,
    );
    expect(
      isReviewHintedCheckIn({
        hint: "first-letters",
        accuracy: LEARN_PROGRESS_ACCURACY,
        kind: "frontier",
      }),
    ).toBe(false);
  });
});

describe("refreshRecentLapseCount", () => {
  it("counts only review-mode tries from before the sitting", () => {
    expect(
      refreshRecentLapseCount(
        [
          { accuracy: 20, createdAt: NOW + 10, mode: "review" },
          { accuracy: 30, createdAt: NOW - 10, mode: "practice" },
          { accuracy: 25, createdAt: NOW - 20, mode: "review" },
          { accuracy: 40, createdAt: NOW - 30, mode: "review" },
          { accuracy: 90, createdAt: NOW - 40, mode: "review" },
        ],
        NOW,
      ),
    ).toBe(2);
  });

  it("ignores held misses from an earlier abandoned Refresh sitting", () => {
    expect(
      refreshRecentLapseCount(
        [
          {
            accuracy: 0,
            createdAt: NOW - 10,
            mode: "review",
            holdSchedule: true,
            hint: "first-letters",
          },
          {
            accuracy: 0,
            createdAt: NOW - 20,
            mode: "review",
            holdSchedule: true,
            hint: "first-letters",
          },
          { accuracy: 90, createdAt: NOW - 40, mode: "review" },
        ],
        NOW,
      ),
    ).toBe(0);
  });
});

describe("isShakyVerse", () => {
  it("is shaky after two lapses in the last three tries", () => {
    expect(isShakyVerse([lapse(), lapse(), hold()])).toBe(true);
  });

  it("is shaky when the last three average under 80%", () => {
    expect(isShakyVerse([hold(70), hold(75), hold(79)])).toBe(true);
  });

  it("is not shaky when recent tries stay accurate", () => {
    expect(isShakyVerse([hold(92), hold(88), hold(96)])).toBe(false);
  });

  it("is not shaky with no history", () => {
    expect(isShakyVerse([])).toBe(false);
  });
});
