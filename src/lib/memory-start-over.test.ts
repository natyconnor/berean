import { describe, expect, it } from "vitest";

import {
  bucketAccuracyAverages,
  bucketReviewCounts,
  computeStreak,
  overallAccuracy,
} from "./dashboard-buckets";
import { EASE_START, initialSchedule } from "./memory-scheduler";
import {
  attemptsSinceStartOver,
  startOverVersePatch,
} from "./memory-start-over";

const NOW = 1_700_000_000_000;
const DAY_MS = 86_400_000;

describe("startOverVersePatch", () => {
  it("resets to New/Read due now and clears lastReviewedAt", () => {
    const next = startOverVersePatch(NOW);
    expect(next).toMatchObject(initialSchedule(NOW));
    expect(next.lastReviewedAt).toBeUndefined();
    expect("lastReviewedAt" in next).toBe(true);
    expect(next.ease).toBe(EASE_START);
    expect(next.status).toBe("new");
    expect(next.learnStage).toBe(0);
    expect(next.stageReps).toBe(0);
    expect(next.dueAt).toBe(NOW);
  });
});

describe("attemptsSinceStartOver", () => {
  const older = { createdAt: NOW - 2 * DAY_MS, accuracy: 40 };
  const atReset = { createdAt: NOW, accuracy: 90 };
  const newer = { createdAt: NOW + 1_000, accuracy: 100 };

  it("keeps every try when the verse has never been reset", () => {
    expect(attemptsSinceStartOver([newer, older], undefined)).toEqual([
      newer,
      older,
    ]);
  });

  it("keeps tries at or after the reset and drops earlier ones", () => {
    expect(attemptsSinceStartOver([newer, atReset, older], NOW)).toEqual([
      newer,
      atReset,
    ]);
  });

  it("returns none when every try is from before the reset", () => {
    expect(attemptsSinceStartOver([older], NOW)).toEqual([]);
  });
});

describe("Start over leaves Progress-page stats whole", () => {
  it("does not change streak, heatmap, or 30-day accuracy", () => {
    const logs = [
      { createdAt: NOW - 2 * DAY_MS, accuracy: 80, mode: "review", stage: 3 },
      { createdAt: NOW - DAY_MS, accuracy: 90, mode: "review", stage: 3 },
    ];
    const createdAts = logs.map((log) => log.createdAt);
    const heatmapBefore = bucketReviewCounts(createdAts, NOW, 30, "UTC");
    const trendBefore = bucketAccuracyAverages(logs, NOW, 30, "UTC");
    const streakBefore = computeStreak(heatmapBefore);
    const accuracyBefore = overallAccuracy(trendBefore);

    expect(attemptsSinceStartOver(logs, NOW)).toEqual([]);

    const heatmapAfter = bucketReviewCounts(createdAts, NOW, 30, "UTC");
    const trendAfter = bucketAccuracyAverages(logs, NOW, 30, "UTC");
    expect(heatmapAfter).toEqual(heatmapBefore);
    expect(trendAfter).toEqual(trendBefore);
    expect(computeStreak(heatmapAfter)).toEqual(streakBefore);
    expect(overallAccuracy(trendAfter)).toBe(accuracyBefore);
    expect(streakBefore.days).toBeGreaterThan(0);
    expect(accuracyBefore).toBe(85);
  });
});
