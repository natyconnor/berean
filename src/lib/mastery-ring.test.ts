import { describe, expect, it } from "vitest";
import { masteryRingFraction } from "./mastery-ring";
import { MASTERED_INTERVAL_DAYS } from "./memory-scheduler";

describe("masteryRingFraction", () => {
  it("shows no ring for new verses", () => {
    expect(masteryRingFraction("new", 0)).toBe(0);
  });

  it("shows no ring for a brand-new learning verse at stage 0 with no reps", () => {
    expect(masteryRingFraction("learning", 0, 0, 0)).toBe(0);
    // Defaults for learnStage/stageReps keep legacy callers at the floor.
    expect(masteryRingFraction("learning", 0)).toBe(0);
  });

  it("grows the learning ring across the ladder, staying below the reviewing band", () => {
    const early = masteryRingFraction("learning", 0, 1, 0);
    const mid = masteryRingFraction("learning", 0, 2, 4);
    const late = masteryRingFraction("learning", 0, 3, 0);
    expect(early).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    expect(late).toBeLessThan(0.5);
  });

  it("banks reps within a band to approach the reviewing floor", () => {
    // Stage 3 (From Memory) needs 1 rep; a full band lands exactly at the floor.
    expect(masteryRingFraction("learning", 0, 3, 1)).toBeCloseTo(0.5);
  });

  it("clamps out-of-range learn stages and rep counts", () => {
    expect(masteryRingFraction("learning", 0, 99, 999)).toBeCloseTo(0.5);
    expect(masteryRingFraction("learning", 0, -1, -5)).toBe(0);
  });

  it("fills fully once mastered", () => {
    expect(masteryRingFraction("mastered", MASTERED_INTERVAL_DAYS)).toBe(1);
  });

  it("grows the reviewing ring from a half toward full with the interval", () => {
    expect(masteryRingFraction("reviewing", 0)).toBe(0.5);
    expect(
      masteryRingFraction("reviewing", MASTERED_INTERVAL_DAYS),
    ).toBeCloseTo(0.9);
    const mid = masteryRingFraction("reviewing", MASTERED_INTERVAL_DAYS / 2);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(0.9);
  });

  it("clamps an over-long reviewing interval to the reviewing ceiling", () => {
    expect(
      masteryRingFraction("reviewing", MASTERED_INTERVAL_DAYS * 4),
    ).toBeCloseTo(0.9);
  });
});
