import { describe, expect, it } from "vitest";

import {
  dueTodayBulkLabel,
  libraryRow,
  libraryRowAction,
} from "./memory-library-row";
import { DAY_MS, MIN_LEARNING_LOCK_MS } from "./memory-scheduler";

// Tue Oct 13 2026, 09:00 in Los Angeles.
const NOW = Date.UTC(2026, 9, 13, 16, 0);
const TZ = "America/Los_Angeles";

describe("libraryRow", () => {
  it("opens today's learning step", () => {
    expect(
      libraryRow({ status: "learning", learnStage: 2, dueAt: NOW }, NOW, TZ),
    ).toEqual({
      line: "Fill in the blanks",
      dueToday: true,
      action: "learn",
    });
  });

  it("waits without a button once today's step is done", () => {
    expect(
      libraryRow(
        {
          status: "learning",
          learnStage: 1,
          dueAt: NOW + MIN_LEARNING_LOCK_MS,
          lastReviewedAt: NOW,
        },
        NOW,
        TZ,
      ),
    ).toEqual({
      line: "Nice. Later today you'll try it with blanks.",
      dueToday: false,
      action: null,
    });
  });

  it("waits until tomorrow when the lock is the next local day", () => {
    expect(
      libraryRow(
        {
          status: "learning",
          learnStage: 1,
          dueAt: NOW + DAY_MS,
          lastReviewedAt: NOW,
        },
        NOW,
        TZ,
      ),
    ).toEqual({
      line: "Nice. Tomorrow you'll try it with blanks.",
      dueToday: false,
      action: null,
    });
  });

  it("lets an Up next verse start early", () => {
    expect(
      libraryRow({ status: "new", learnStage: 0, dueAt: NOW }, NOW, TZ),
    ).toEqual({
      line: "Up next. Starts when you're ready.",
      dueToday: false,
      action: "learn",
    });
  });

  it("reviews a due verse and practices one that is not due", () => {
    expect(
      libraryRow({ status: "reviewing", learnStage: 3, dueAt: NOW }, NOW, TZ),
    ).toEqual({ line: "Review due today", dueToday: true, action: "review" });
    expect(
      libraryRow(
        { status: "mastered", learnStage: 3, dueAt: NOW + 2 * DAY_MS },
        NOW,
        TZ,
      ),
    ).toEqual({ line: "Next review Thu", dueToday: false, action: "practice" });
  });

  it("agrees with the action helper", () => {
    expect(
      libraryRowAction({ status: "reviewing", learnStage: 3, dueAt: NOW }, NOW),
    ).toBe("review");
  });
});

describe("dueTodayBulkLabel", () => {
  it("does everything left today", () => {
    expect(
      dueTodayBulkLabel({ learningVerses: 2, passageSessions: 0, reviews: 3 }),
    ).toBe("Do all 5 · about 9 min");
  });

  it("says Review all when only reviews are left", () => {
    expect(
      dueTodayBulkLabel({ learningVerses: 0, passageSessions: 0, reviews: 3 }),
    ).toBe("Review all 3 · about 3 min");
  });

  it("is absent when nothing is left", () => {
    expect(
      dueTodayBulkLabel({ learningVerses: 0, passageSessions: 0, reviews: 0 }),
    ).toBeNull();
  });
});
