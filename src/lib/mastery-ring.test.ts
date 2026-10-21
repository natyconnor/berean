import { describe, expect, it } from "vitest";
import {
  learningJourneyFraction,
  LEARNING_RING_CEILING,
  masteryRingFraction,
  memoryProgressFraction,
} from "./mastery-ring";
import {
  EASE_START,
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  requiredRepsFor,
  REVIEW_DAILY_INTERVAL_DAYS,
  REVIEW_DAILY_REPS,
  REVIEW_EVERY_OTHER_INTERVAL_DAYS,
  REVIEW_EVERY_OTHER_REPS,
  holdReviewingInterval,
  scheduleNext,
  type MemorySchedule,
} from "./memory-scheduler";

const NOW = 1_700_000_000_000;

function reviewingAt(overrides: Partial<MemorySchedule> = {}): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
    dueAt: NOW,
    consecutiveCorrect: 0,
    lapses: 0,
    earlyReviewApplied: false,
    ...overrides,
  };
}

function exactReview(s: MemorySchedule): MemorySchedule {
  return scheduleNext(s, {
    quality: "exact",
    accuracy: 100,
    mode: "review",
    now: s.dueAt,
  });
}

function barOf(
  s: Pick<
    MemorySchedule,
    "status" | "learnStage" | "stageReps" | "intervalDays" | "ease"
  >,
): number {
  return memoryProgressFraction(
    s.status,
    s.learnStage,
    s.stageReps,
    s.intervalDays,
    undefined,
    s.ease,
  );
}

function ringOf(
  s: Pick<
    MemorySchedule,
    "status" | "intervalDays" | "learnStage" | "stageReps" | "ease"
  >,
): number {
  return masteryRingFraction(
    s.status,
    s.intervalDays,
    s.learnStage,
    s.stageReps,
    s.ease,
  );
}

function pathToMastered(start: MemorySchedule): MemorySchedule[] {
  const path = [start];
  let s = start;
  for (let i = 0; i < 64 && s.status !== "mastered"; i += 1) {
    s = exactReview(s);
    path.push(s);
  }
  return path;
}

function expectEqualReviewingShares(start: MemorySchedule) {
  const path = pathToMastered(start);
  const exacts = path.length - 1;
  expect(exacts).toBeGreaterThan(REVIEW_DAILY_REPS + REVIEW_EVERY_OTHER_REPS);
  const barStep = 1 / exacts;
  const ringStep = 0.4 / exacts;
  for (let i = 1; i < exacts; i += 1) {
    expect(barOf(path[i]) - barOf(path[i - 1])).toBeCloseTo(barStep, 10);
    expect(ringOf(path[i]) - ringOf(path[i - 1])).toBeCloseTo(ringStep, 10);
    expect(ringOf(path[i])).toBeCloseTo(0.5 + barOf(path[i]) * 0.4, 10);
    expect(ringOf(path[i])).toBeGreaterThanOrEqual(0.5);
    expect(ringOf(path[i])).toBeLessThan(0.9);
  }
  expect(barOf(path[exacts]) - barOf(path[exacts - 1])).toBeCloseTo(
    barStep,
    10,
  );
  expect(barOf(path[exacts])).toBe(1);
  expect(ringOf(path[exacts])).toBe(1);
  expect(path[exacts]?.status).toBe("mastered");
}

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
    const mid = masteryRingFraction("learning", 0, 2, 2);
    const late = masteryRingFraction("learning", 0, 3, 0);
    expect(early).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    expect(late).toBeLessThan(0.5);
  });

  it("banks reps within a band to approach the reviewing floor", () => {
    // Clearing the last band (From Memory) lands exactly at the floor.
    expect(
      masteryRingFraction("learning", 0, 3, requiredRepsFor(3)),
    ).toBeCloseTo(0.5);
  });

  it("clamps out-of-range learn stages and rep counts", () => {
    expect(masteryRingFraction("learning", 0, 99, 999)).toBeCloseTo(0.5);
    expect(masteryRingFraction("learning", 0, -1, -5)).toBe(0);
  });

  it("fills fully once mastered", () => {
    expect(masteryRingFraction("mastered", MASTERED_INTERVAL_DAYS)).toBe(1);
  });

  it("starts the reviewing ring at the learning ceiling for a fresh graduate", () => {
    expect(ringOf(reviewingAt())).toBe(0.5);
    expect(masteryRingFraction("reviewing", 0)).toBe(0.5);
  });

  it("fills the reviewing ring by the same per-exact share as the mastery bar", () => {
    expectEqualReviewingShares(reviewingAt());
  });

  it("banks daily and every-other-day reviewing reps on the heart ring", () => {
    let s = reviewingAt();
    let previous = ringOf(s);
    for (let reps = 1; reps < REVIEW_DAILY_REPS; reps += 1) {
      s = exactReview(s);
      expect(s.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
      expect(s.stageReps).toBe(reps);
      expect(ringOf(s)).toBeGreaterThan(previous);
      previous = ringOf(s);
    }
    s = exactReview(s);
    expect(s.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(ringOf(s)).toBeGreaterThan(previous);
    previous = ringOf(s);
    for (let reps = 1; reps < REVIEW_EVERY_OTHER_REPS; reps += 1) {
      s = exactReview(s);
      expect(s.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
      expect(s.stageReps).toBe(reps);
      expect(ringOf(s)).toBeGreaterThan(previous);
      previous = ringOf(s);
    }
  });

  it("keeps a 30-day reviewing interval at the reviewing ceiling, not full", () => {
    expect(
      masteryRingFraction("reviewing", MASTERED_INTERVAL_DAYS),
    ).toBeCloseTo(0.9);
    expect(
      masteryRingFraction("reviewing", MASTERED_INTERVAL_DAYS * 4),
    ).toBeCloseTo(0.9);
  });
});

describe("learningJourneyFraction", () => {
  /** Short-verse total: Read 1 + Guided 3 + Challenge 4 + From Memory 2. */
  const shortTotal =
    requiredRepsFor(0) +
    requiredRepsFor(1) +
    requiredRepsFor(2) +
    requiredRepsFor(3);

  it("returns 0 at the very start (stage 0, no reps)", () => {
    expect(learningJourneyFraction(0, 0)).toBe(0);
  });

  it("each successful Continue fills the same fraction of the bar", () => {
    // Short verse: 10 exact reps across the journey → each Continue = 1/10.
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
      learningJourneyFraction(3, 0) - learningJourneyFraction(2, 3),
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
    // 24-word verse: Guided 5 + Challenge 5 + From Memory 2 → total 1+5+5+2 = 13.
    const longWordCount = 24;
    const longTotal =
      requiredRepsFor(0, longWordCount) +
      requiredRepsFor(1, longWordCount) +
      requiredRepsFor(2, longWordCount) +
      requiredRepsFor(3, longWordCount);
    expect(longTotal).toBe(13);
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

describe("memoryProgressFraction", () => {
  it("fills a learning bar from 0 to 100% learned", () => {
    expect(memoryProgressFraction("learning", 0, 0)).toBe(0);
    const mid = memoryProgressFraction("learning", 2, 2);
    expect(mid).toBeCloseTo(
      learningJourneyFraction(2, 2, undefined, "learning"),
    );
    expect(mid).toBeGreaterThan(LEARNING_RING_CEILING);
    expect(
      memoryProgressFraction("learning", 3, requiredRepsFor(3)),
    ).toBeCloseTo(1);
  });

  it("starts a separate mastery bar at 0 for a fresh graduate", () => {
    expect(barOf(reviewingAt())).toBe(0);
    expect(memoryProgressFraction("reviewing", 3, 0, 0)).toBe(0);
  });

  it("fills an equal share of the bar for each exact on the path to mastered", () => {
    expectEqualReviewingShares(reviewingAt());
  });

  it("keeps a 1/total share on every exact through mastered at several eases", () => {
    for (const ease of [1.3, EASE_START, 2.37, 2.8]) {
      expectEqualReviewingShares(reviewingAt({ ease }));
    }
  });

  it("increases while banking daily streak reps before the interval leaves 1 day", () => {
    let s = reviewingAt();
    const fractions = [barOf(s)];
    for (let reps = 1; reps < REVIEW_DAILY_REPS; reps += 1) {
      s = exactReview(s);
      expect(s.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
      expect(s.stageReps).toBe(reps);
      fractions.push(barOf(s));
    }
    for (let i = 1; i < fractions.length; i += 1) {
      expect(fractions[i]).toBeGreaterThan(fractions[i - 1]);
    }
  });

  it("increases while banking every-other-day streak reps before the interval grows", () => {
    let s = reviewingAt({
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      consecutiveCorrect: REVIEW_DAILY_REPS,
    });
    const fractions = [barOf(s)];
    for (let reps = 1; reps < REVIEW_EVERY_OTHER_REPS; reps += 1) {
      s = exactReview(s);
      expect(s.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
      expect(s.stageReps).toBe(reps);
      fractions.push(barOf(s));
    }
    for (let i = 1; i < fractions.length; i += 1) {
      expect(fractions[i]).toBeGreaterThan(fractions[i - 1]);
    }
  });

  it("keeps advancing as the interval grows, and treats 30d+ as mastered", () => {
    let s = reviewingAt({
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      consecutiveCorrect: REVIEW_DAILY_REPS,
      stageReps: REVIEW_EVERY_OTHER_REPS - 1,
    });
    s = exactReview(s);
    expect(s.intervalDays).toBeGreaterThan(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    let previous = barOf(s);
    while (s.status === "reviewing") {
      s = exactReview(s);
      expect(barOf(s)).toBeGreaterThan(previous);
      previous = barOf(s);
    }
    expect(s.status).toBe("mastered");
    expect(barOf(s)).toBe(1);
    expect(
      memoryProgressFraction("reviewing", 3, 0, MASTERED_INTERVAL_DAYS),
    ).toBe(1);
    expect(
      memoryProgressFraction("reviewing", 3, 0, MASTERED_INTERVAL_DAYS * 4),
    ).toBe(1);
  });

  it("does not move on retry or hold, and drops only on a lapse", () => {
    const s = reviewingAt({
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      stageReps: 2,
    });
    const before = barOf(s);
    const retry = scheduleNext(s, {
      quality: "close",
      accuracy: 82,
      mode: "review",
      now: s.dueAt,
    });
    const hold = scheduleNext(s, {
      quality: "close",
      accuracy: 70,
      mode: "review",
      now: s.dueAt,
    });
    const lapse = scheduleNext(s, {
      quality: "off",
      accuracy: 40,
      mode: "review",
      now: s.dueAt,
    });
    expect(barOf(retry)).toBe(before);
    expect(barOf(hold)).toBe(before);
    expect(barOf(holdReviewingInterval(s, s.dueAt))).toBe(before);
    expect(barOf(lapse)).toBeLessThan(before);

    const early = scheduleNext(s, {
      quality: "exact",
      accuracy: 100,
      mode: "review",
      now: s.dueAt - 1,
    });
    const secondEarly = scheduleNext(early, {
      quality: "exact",
      accuracy: 100,
      mode: "review",
      now: early.dueAt - 1,
    });
    expect(barOf(secondEarly)).toBe(barOf(early));
    expect(ringOf(secondEarly)).toBe(ringOf(early));
  });

  it("does not drop on an exact when the live ease could not have produced this interval", () => {
    const s = reviewingAt({ intervalDays: 2.6, ease: 2.0 });
    const next = exactReview(s);
    expect(next.intervalDays).toBeCloseTo(5.2, 5);
    expect(next.ease).toBeCloseTo(2.05, 5);
    expect(barOf(s)).toBeGreaterThan(0);
    expect(barOf(s)).toBeLessThan(1);
    expect(Number.isFinite(barOf(s))).toBe(true);
    expect(barOf(next)).toBeGreaterThanOrEqual(barOf(s));
    expect(ringOf(next)).toBeGreaterThanOrEqual(ringOf(s));
    expect(barOf(next)).toBeLessThanOrEqual(1);
    expect(Number.isFinite(barOf(next))).toBe(true);
  });

  it("does not drop on an exact when no start ease matches both interval and ease", () => {
    const s = reviewingAt({ intervalDays: 5.2, ease: 2.05 });
    const next = exactReview(s);
    expect(barOf(s)).toBeGreaterThanOrEqual(0);
    expect(barOf(s)).toBeLessThanOrEqual(1);
    expect(Number.isFinite(barOf(s))).toBe(true);
    expect(barOf(next)).toBeGreaterThanOrEqual(barOf(s));
    expect(ringOf(next)).toBeGreaterThanOrEqual(ringOf(s));
    expect(barOf(next)).toBeLessThanOrEqual(1);
    expect(Number.isFinite(barOf(next))).toBe(true);
  });

  it("stays in [0, 1] for odd reviewing rows", () => {
    const eases = [0, -1, Number.NaN, 5];
    const intervals = [0, -1, Number.NaN, 1.4, 2.4, 7.3];
    const repsList = [-2, 9, Number.NaN];
    for (const ease of eases) {
      for (const intervalDays of intervals) {
        for (const stageReps of repsList) {
          const bar = memoryProgressFraction(
            "reviewing",
            3,
            stageReps,
            intervalDays,
            undefined,
            ease,
          );
          const ring = masteryRingFraction(
            "reviewing",
            intervalDays,
            3,
            stageReps,
            ease,
          );
          expect(Number.isFinite(bar)).toBe(true);
          expect(bar).toBeGreaterThanOrEqual(0);
          expect(bar).toBeLessThanOrEqual(1);
          expect(Number.isFinite(ring)).toBe(true);
          expect(ring).toBeGreaterThanOrEqual(0);
          expect(ring).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("leaves learning-phase bar behavior unchanged", () => {
    expect(memoryProgressFraction("learning", 0, 0)).toBe(0);
    expect(memoryProgressFraction("learning", 1, 0)).toBeCloseTo(
      learningJourneyFraction(1, 0),
    );
    expect(memoryProgressFraction("learning", 2, 2)).toBeCloseTo(
      learningJourneyFraction(2, 2, undefined, "learning"),
    );
  });

  it("fills the mastery bar once mastered", () => {
    expect(
      memoryProgressFraction("mastered", 3, 0, MASTERED_INTERVAL_DAYS),
    ).toBe(1);
  });
});
