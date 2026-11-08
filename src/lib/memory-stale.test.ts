import { describe, expect, it } from "vitest";

import { DAY_MS } from "./memory-scheduler";
import { isStaleVerse, recentReviewLapsed } from "./memory-stale";

const NOW = 1_700_000_000_000;

function input(over: Partial<Parameters<typeof isStaleVerse>[0]> = {}) {
  return {
    status: "reviewing" as const,
    dueAt: NOW,
    intervalDays: 3,
    now: NOW,
    lastReviews: [],
    ...over,
  };
}

const tries = (...accuracies: number[]) =>
  accuracies.map((accuracy) => ({ accuracy }));

describe("recentReviewLapsed", () => {
  it("counts under 60% as a lapse and 60% and up as not", () => {
    expect(recentReviewLapsed(59)).toBe(true);
    expect(recentReviewLapsed(59.9)).toBe(true);
    expect(recentReviewLapsed(60)).toBe(false);
    expect(recentReviewLapsed(84)).toBe(false);
  });
});

describe("isStaleVerse", () => {
  it("is stale at exactly 7 days overdue on a short gap, not a moment before", () => {
    expect(isStaleVerse(input({ dueAt: NOW - 7 * DAY_MS }))).toBe(true);
    expect(isStaleVerse(input({ dueAt: NOW - 7 * DAY_MS + 1 }))).toBe(false);
  });

  it("waits for its own gap when that is longer than 7 days", () => {
    const longGap = { intervalDays: 20 };
    expect(isStaleVerse(input({ ...longGap, dueAt: NOW - 10 * DAY_MS }))).toBe(
      false,
    );
    expect(
      isStaleVerse(input({ ...longGap, dueAt: NOW - 20 * DAY_MS + 1 })),
    ).toBe(false);
    expect(isStaleVerse(input({ ...longGap, dueAt: NOW - 20 * DAY_MS }))).toBe(
      true,
    );
  });

  it("is not stale when due or not yet due", () => {
    expect(isStaleVerse(input())).toBe(false);
    expect(isStaleVerse(input({ dueAt: NOW + 3 * DAY_MS }))).toBe(false);
  });

  it("is stale when 2 of the last 3 tries are under 60%", () => {
    expect(isStaleVerse(input({ lastReviews: tries(40, 90, 59) }))).toBe(true);
    expect(isStaleVerse(input({ lastReviews: tries(10, 20) }))).toBe(true);
  });

  it("does not count 60–84% tries as lapses", () => {
    expect(isStaleVerse(input({ lastReviews: tries(60, 84, 30) }))).toBe(false);
    expect(isStaleVerse(input({ lastReviews: tries(40, 72, 95) }))).toBe(false);
  });

  it("reads only the newest 3 tries", () => {
    // Newest first: the two old misses are 4th and 5th.
    expect(
      isStaleVerse(input({ lastReviews: tries(90, 95, 40, 10, 20) })),
    ).toBe(false);
  });

  it("ignores tries from before the latest Start over", () => {
    const startedOverAt = NOW - 2 * DAY_MS;
    const lastReviews = [
      { accuracy: 92, createdAt: NOW - DAY_MS },
      { accuracy: 20, createdAt: NOW - 3 * DAY_MS },
      { accuracy: 30, createdAt: NOW - 4 * DAY_MS },
    ];
    expect(isStaleVerse(input({ lastReviews }))).toBe(true);
    expect(isStaleVerse(input({ lastReviews, startedOverAt }))).toBe(false);
  });

  it("counts a try made exactly at the Start over", () => {
    const startedOverAt = NOW - DAY_MS;
    expect(
      isStaleVerse(
        input({
          startedOverAt,
          lastReviews: [
            { accuracy: 20, createdAt: NOW },
            { accuracy: 30, createdAt: startedOverAt },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("is never stale for New or Learning verses", () => {
    for (const status of ["new", "learning"] as const) {
      expect(
        isStaleVerse(
          input({
            status,
            dueAt: NOW - 30 * DAY_MS,
            lastReviews: tries(10, 20, 30),
          }),
        ),
      ).toBe(false);
    }
  });

  it("treats Mastered like Memorized", () => {
    expect(
      isStaleVerse(
        input({
          status: "mastered",
          intervalDays: 35,
          dueAt: NOW - 35 * DAY_MS,
        }),
      ),
    ).toBe(true);
    expect(
      isStaleVerse(
        input({ status: "mastered", intervalDays: 35, dueAt: NOW - DAY_MS }),
      ),
    ).toBe(false);
  });
});
