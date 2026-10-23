import { describe, expect, it } from "vitest";

import { DAY_MS } from "./memory-scheduler";
import { isShakyVerse, isStaleVerse, type RecentReview } from "./memory-stale";

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
