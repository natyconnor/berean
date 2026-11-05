import { describe, expect, it } from "vitest";

import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
  recalledCopy,
  refresherResultCopy,
  type ReviewSessionAttempt,
} from "./review-session-attempts";

const john: ReviewSessionAttempt = {
  reference: { book: "John", chapter: 3, startVerse: 16, endVerse: 16 },
  accuracy: 85,
};

describe("averageReviewAccuracy", () => {
  it("returns null when nothing was graded", () => {
    expect(averageReviewAccuracy([])).toBeNull();
  });

  it("averages every recitation, including retries", () => {
    expect(averageReviewAccuracy([john, { ...john, accuracy: 100 }])).toBe(93);
  });
});

describe("groupReviewSessionAttempts", () => {
  it("keeps each recitation on one verse row", () => {
    const grouped = groupReviewSessionAttempts([
      john,
      { ...john, accuracy: 100 },
      {
        reference: { book: "John", chapter: 1, startVerse: 1, endVerse: 1 },
        accuracy: 90,
      },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.accuracies).toEqual([85, 100]);
    expect(grouped[1]?.accuracies).toEqual([90]);
  });

  it("keeps a later refresher and landed schedule on the same row", () => {
    const schedule = {
      status: "reviewing" as const,
      learnStage: 3,
      stageReps: 2,
      intervalDays: 5,
      ease: 2.3,
      dueAt: 1_700_000_000_000,
    };
    const grouped = groupReviewSessionAttempts([
      { ...john, accuracy: 78 },
      {
        ...john,
        accuracy: 100,
        refresherUsed: true,
        schedule,
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.accuracies).toEqual([78, 100]);
    expect(grouped[0]?.refresherUsed).toBe(true);
    expect(grouped[0]?.schedule).toEqual(schedule);
  });
});

describe("recalledCopy", () => {
  it("names a retry as a second score", () => {
    expect(recalledCopy([85, 100])).toBe("85%, then 100% recalled");
  });
});

describe("refresherResultCopy", () => {
  it("names the first and last scores when a refresher was used", () => {
    expect(refresherResultCopy([78, 100])).toBe("78% → 100% · Refresher used");
  });
});
