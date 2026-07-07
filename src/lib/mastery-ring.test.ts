import { describe, expect, it } from "vitest";
import { masteryRingFraction } from "./mastery-ring";
import { MASTERED_INTERVAL_DAYS } from "./memory-scheduler";

describe("masteryRingFraction", () => {
  it("shows no ring for new and suspended verses", () => {
    expect(masteryRingFraction("new", 0)).toBe(0);
    expect(masteryRingFraction("suspended", 12)).toBe(0);
  });

  it("shows a quarter ring while learning", () => {
    expect(masteryRingFraction("learning", 0)).toBe(0.25);
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
