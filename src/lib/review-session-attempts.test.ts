import { describe, expect, it } from "vitest";

import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
  lastTryNeedsRefresh,
  recalledCopy,
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

  it("counts a miss and both refresher passes as 67%", () => {
    expect(
      averageReviewAccuracy([
        { ...john, accuracy: 0 },
        { ...john, accuracy: 100 },
        { ...john, accuracy: 100 },
      ]),
    ).toBe(67);
  });

  it("leaves held first-letter retries out of the average", () => {
    expect(
      averageReviewAccuracy([
        { ...john, accuracy: 0, hint: "first-letters" },
        {
          ...john,
          accuracy: 100,
          hint: "first-letters",
          holdSchedule: true,
        },
        { ...john, accuracy: 100, holdSchedule: true },
      ]),
    ).toBe(50);
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
});

describe("recalledCopy", () => {
  it("names a retry as a second score", () => {
    expect(recalledCopy([85, 100])).toBe("85%, then 100% recalled");
  });

  it("puts then only before the last of three or more scores", () => {
    expect(recalledCopy([0, 100, 100])).toBe("0%, 100%, then 100% recalled");
  });
});

describe("lastTryNeedsRefresh", () => {
  it("gates Refresh on the last try, not an earlier miss", () => {
    expect(lastTryNeedsRefresh([0, 100, 100])).toBe(false);
    expect(lastTryNeedsRefresh([0, 100, 40])).toBe(true);
    expect(lastTryNeedsRefresh([90, 40])).toBe(true);
    expect(lastTryNeedsRefresh([])).toBe(false);
  });
});
