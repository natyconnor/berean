import { describe, expect, it } from "vitest";

import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
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
});
