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
  /** Short-verse total: Read 1 + Guided 3 + Challenge 5 + From Memory 1. */
  const shortTotal =
    requiredRepsFor(0) +
    requiredRepsFor(1) +
    requiredRepsFor(2) +
    requiredRepsFor(3);

  it("returns 0 at the very start (stage 0, no reps)", () => {
    expect(learningJourneyFraction(0, 0)).toBe(0);
  });

  it("each successful Continue fills the same fraction of the bar", () => {
    // Short verse: 10 exact reps across the journey → each Continue = 10%.
    expect(shortTotal).toBe(10);
    const step = 1 / shortTotal;

    // Read continue: stage 0 → stage 1.
    expect(
      learningJourneyFraction(1, 0) - learningJourneyFraction(0, 0),
    ).toBeCloseTo(step);
    // Guided continues within the band.
    expect(
      learningJourneyFraction(1, 1) - learningJourneyFraction(1, 0),
    ).toBeCloseTo(step);
    expect(
      learningJourneyFraction(1, 2) - learningJourneyFraction(1, 1),
    ).toBeCloseTo(step);
    // Clearing Guided lands on Challenge at 0 — same fill as banking the last Guided rep.
    expect(learningJourneyFraction(2, 0)).toBeCloseTo(
      learningJourneyFraction(1, 3),
    );
    expect(
      learningJourneyFraction(2, 0) - learningJourneyFraction(1, 2),
    ).toBeCloseTo(step);
    // From Memory start is after all prior bands; one more Continue fills the last step.
    expect(
      learningJourneyFraction(3, 0) - learningJourneyFraction(2, 4),
    ).toBeCloseTo(step);
    expect(
      learningJourneyFraction(3, 1) - learningJourneyFraction(3, 0),
    ).toBeCloseTo(step);
  });

  it("clearing Read (stage 0 → 1) moves by one rep step", () => {
    const before = learningJourneyFraction(0, 0);
    const after = learningJourneyFraction(1, 0);
    expect(after - before).toBeCloseTo(1 / shortTotal);
  });

  it("banking Guided reps fills proportionally across the whole journey", () => {
    const guidedRequired = requiredRepsFor(1); // 3 for short verse
    const halfReps = Math.round(guidedRequired / 2);
    const fraction = learningJourneyFraction(1, halfReps);
    // Read cleared (1) + half Guided reps, over the short-verse total.
    expect(fraction).toBeCloseTo((1 + halfReps) / shortTotal, 5);
  });

  it("banking all required reps on Challenge exactly reaches From Memory's start", () => {
    const challengeRequired = requiredRepsFor(2);
    const fromMemoryFloor =
      (requiredRepsFor(0) + requiredRepsFor(1) + challengeRequired) /
      shortTotal;
    expect(learningJourneyFraction(2, challengeRequired)).toBeCloseTo(
      fromMemoryFloor,
    );
    expect(learningJourneyFraction(3, 0)).toBeCloseTo(fromMemoryFloor);
  });

  it("the full journey reaches 1 exactly when all bands are cleared", () => {
    const fromMemoryRequired = requiredRepsFor(3);
    expect(learningJourneyFraction(3, fromMemoryRequired)).toBeCloseTo(1);
  });

  it("graduating to reviewing fills the journey to 1 even with stageReps reset", () => {
    // Scheduler resets stageReps to 0 on graduation while leaving learnStage at
    // From Memory — without status the bar would drop to the From Memory floor.
    const fromMemoryFloor =
      (requiredRepsFor(0) + requiredRepsFor(1) + requiredRepsFor(2)) /
      shortTotal;
    expect(learningJourneyFraction(3, 0, undefined, "reviewing")).toBe(1);
    expect(learningJourneyFraction(3, 0, undefined, "mastered")).toBe(1);
    expect(learningJourneyFraction(3, 0, undefined, "learning")).toBeCloseTo(
      fromMemoryFloor,
    );
  });

  it("length-adjusted Guided reps shift the fraction correctly", () => {
    // 24-word verse: Guided 7 + Challenge 12 → total 1+7+12+1 = 21.
    const longWordCount = 24;
    const longTotal =
      requiredRepsFor(0, longWordCount) +
      requiredRepsFor(1, longWordCount) +
      requiredRepsFor(2, longWordCount) +
      requiredRepsFor(3, longWordCount);
    expect(longTotal).toBe(21);
    // Read cleared (1) + one Guided rep.
    const oneRep = learningJourneyFraction(1, 1, longWordCount);
    expect(oneRep).toBeCloseTo(2 / longTotal, 5);
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
