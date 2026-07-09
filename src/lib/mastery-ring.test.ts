import { describe, expect, it } from "vitest";
import { learningJourneyFraction, masteryRingFraction } from "./mastery-ring";
import { MASTERED_INTERVAL_DAYS, requiredRepsFor } from "./memory-scheduler";

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

describe("learningJourneyFraction", () => {
  it("returns 0 at the very start (stage 0, no reps)", () => {
    expect(learningJourneyFraction(0, 0)).toBe(0);
  });

  it("clearing Read (stage 0 → 1) moves the fraction by exactly 1/4", () => {
    // Stage 0 at 0 reps → 0; stage 1 at 0 reps → 1/4.
    const before = learningJourneyFraction(0, 0);
    const after = learningJourneyFraction(1, 0);
    expect(after - before).toBeCloseTo(0.25);
  });

  it("banking half of Guided's required reps fills halfway through that slice", () => {
    // Guided (stage 1) slice spans 0.25 → 0.50; halfway is 0.375.
    const guidedRequired = requiredRepsFor(1); // 3 for short verse
    const halfReps = Math.round(guidedRequired / 2);
    const fraction = learningJourneyFraction(1, halfReps);
    expect(fraction).toBeGreaterThan(0.25);
    expect(fraction).toBeLessThan(0.5);
    expect(fraction).toBeCloseTo(0.25 + (halfReps / guidedRequired) * 0.25, 5);
  });

  it("banking all required reps on Challenge exactly reaches From Memory's start", () => {
    // Stage 2 fully banked → stage 3 at 0 reps = 3/4 = 0.75.
    const challengeRequired = requiredRepsFor(2);
    expect(learningJourneyFraction(2, challengeRequired)).toBeCloseTo(0.75);
    expect(learningJourneyFraction(3, 0)).toBeCloseTo(0.75);
  });

  it("the full journey reaches 1 exactly when all bands are cleared", () => {
    const fromMemoryRequired = requiredRepsFor(3);
    expect(learningJourneyFraction(3, fromMemoryRequired)).toBeCloseTo(1);
  });

  it("graduating to reviewing fills the journey to 1 even with stageReps reset", () => {
    // Scheduler resets stageReps to 0 on graduation while leaving learnStage at
    // From Memory — without status the bar would stick at 0.75.
    expect(learningJourneyFraction(3, 0, undefined, "reviewing")).toBe(1);
    expect(learningJourneyFraction(3, 0, undefined, "mastered")).toBe(1);
    expect(learningJourneyFraction(3, 0, undefined, "learning")).toBeCloseTo(
      0.75,
    );
  });

  it("length-adjusted Guided reps shift the fraction correctly", () => {
    // 24-word verse: Guided needs 7 reps (max). One rep = 1/7 of the Guided slice.
    const longWordCount = 24;
    const guidedRequired = requiredRepsFor(1, longWordCount); // 7
    const oneRep = learningJourneyFraction(1, 1, longWordCount);
    expect(oneRep).toBeCloseTo(0.25 + (1 / guidedRequired) * 0.25, 5);
  });

  it("masteryRingFraction learning case equals learningJourneyFraction × 0.5", () => {
    // The two helpers must stay in lockstep.
    const ring = masteryRingFraction("learning", 0, 2, 3);
    const journey = learningJourneyFraction(2, 3);
    expect(ring).toBeCloseTo(journey * 0.5, 10);
  });

  it("clamps out-of-range inputs", () => {
    expect(learningJourneyFraction(99, 999)).toBeCloseTo(1);
    expect(learningJourneyFraction(-1, -5)).toBe(0);
  });
});
