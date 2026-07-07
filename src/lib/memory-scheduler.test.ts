import { describe, expect, it } from "vitest";

import {
  EASE_MAX,
  EASE_MIN,
  EASE_START,
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  initialSchedule,
  scheduleNext,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function review(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    quality: "exact",
    accuracy: 100,
    mode: "learn",
    now: NOW,
    ...overrides,
  };
}

function learningAt(stage: number): MemorySchedule {
  return {
    status: "learning",
    learnStage: stage,
    ease: EASE_START,
    intervalDays: 0,
    dueAt: NOW,
    consecutiveCorrect: 0,
    lapses: 0,
  };
}

function reviewing(overrides: Partial<MemorySchedule> = {}): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    ease: EASE_START,
    intervalDays: 5,
    dueAt: NOW,
    consecutiveCorrect: 3,
    lapses: 0,
    ...overrides,
  };
}

/** Effective interval implied by dueAt, in days (undoes the fuzz). */
function effectiveIntervalDays(dueAt: number, now: number): number {
  return (dueAt - now) / DAY_MS;
}

describe("initialSchedule", () => {
  it("seeds a fresh new-status verse due immediately", () => {
    expect(initialSchedule(NOW)).toEqual({
      status: "new",
      learnStage: 0,
      ease: EASE_START,
      intervalDays: 0,
      dueAt: NOW,
      consecutiveCorrect: 0,
      lapses: 0,
    });
  });
});

describe("new -> learning graduation path", () => {
  it("moves a new verse to learning on its first attempt", () => {
    const next = scheduleNext(
      initialSchedule(NOW),
      review({ quality: "exact" }),
    );
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(1);
  });

  it("walks all four stages then graduates to reviewing with a 1-day interval", () => {
    let s = initialSchedule(NOW);
    // Stages 0 -> 1 -> 2 -> 3 (each exact advances a stage, staying in learning).
    for (const expectedStage of [1, 2, 3]) {
      s = scheduleNext(s, review({ quality: "exact" }));
      expect(s.status).toBe("learning");
      expect(s.learnStage).toBe(expectedStage);
      expect(s.intervalDays).toBe(0);
      expect(s.dueAt).toBe(NOW);
    }
    // Exact at the hidden stage graduates into reviewing.
    s = scheduleNext(s, review({ quality: "exact" }));
    expect(s.status).toBe("reviewing");
    expect(s.learnStage).toBe(MAX_LEARN_STAGE);
    expect(s.intervalDays).toBe(1);
    expect(s.consecutiveCorrect).toBe(4);
  });
});

describe("learning phase grades", () => {
  it("exact advances a stage", () => {
    const next = scheduleNext(learningAt(1), review({ quality: "exact" }));
    expect(next.learnStage).toBe(2);
    expect(next.status).toBe("learning");
    expect(next.consecutiveCorrect).toBe(1);
  });

  it("close stays on the current stage", () => {
    const next = scheduleNext(learningAt(2), review({ quality: "close" }));
    expect(next.learnStage).toBe(2);
    expect(next.status).toBe("learning");
    expect(next.dueAt).toBe(NOW);
  });

  it("off drops one stage but never below 0", () => {
    expect(
      scheduleNext(learningAt(2), review({ quality: "off" })).learnStage,
    ).toBe(1);
    expect(
      scheduleNext(learningAt(0), review({ quality: "off" })).learnStage,
    ).toBe(0);
  });
});

describe("reviewing phase grades", () => {
  it("exact multiplies interval by ease and bumps ease", () => {
    const s = reviewing({ intervalDays: 5, ease: 2.3 });
    const next = scheduleNext(s, review({ quality: "exact" }));
    expect(next.intervalDays).toBeCloseTo(5 * 2.3, 5);
    expect(next.ease).toBeCloseTo(2.35, 5);
    expect(next.consecutiveCorrect).toBe(4);
    expect(next.status).toBe("reviewing");
  });

  it("close multiplies interval by ease * 0.8 and leaves ease unchanged", () => {
    const s = reviewing({ intervalDays: 5, ease: 2.3, consecutiveCorrect: 3 });
    const next = scheduleNext(s, review({ quality: "close" }));
    expect(next.intervalDays).toBeCloseTo(5 * 2.3 * 0.8, 5);
    expect(next.ease).toBeCloseTo(2.3, 5);
    expect(next.consecutiveCorrect).toBe(3);
    expect(next.status).toBe("reviewing");
  });

  it("off lapses: interval -> 1d, ease -0.2, lapses++, back to learning", () => {
    const s = reviewing({ intervalDays: 20, ease: 2.3, lapses: 1 });
    const next = scheduleNext(s, review({ quality: "off" }));
    expect(next.intervalDays).toBe(1);
    expect(next.ease).toBeCloseTo(2.1, 5);
    expect(next.lapses).toBe(2);
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(0);
    expect(next.consecutiveCorrect).toBe(0);
  });
});

describe("ease clamping", () => {
  it("floors ease at EASE_MIN on repeated lapses", () => {
    const s = reviewing({ ease: EASE_MIN + 0.1 });
    const next = scheduleNext(s, review({ quality: "off" }));
    expect(next.ease).toBe(EASE_MIN);
  });

  it("caps ease at EASE_MAX on repeated exact reviews", () => {
    const s = reviewing({ ease: EASE_MAX - 0.02 });
    const next = scheduleNext(s, review({ quality: "exact" }));
    expect(next.ease).toBe(EASE_MAX);
  });
});

describe("mastery threshold", () => {
  it("promotes to mastered once the interval reaches 30 days", () => {
    const s = reviewing({ intervalDays: 15, ease: 2.3 });
    const next = scheduleNext(s, review({ quality: "exact" }));
    expect(next.intervalDays).toBeGreaterThanOrEqual(MASTERED_INTERVAL_DAYS);
    expect(next.status).toBe("mastered");
  });

  it("keeps a verse reviewing while below the threshold", () => {
    const s = reviewing({ intervalDays: 5, ease: 2.3 });
    const next = scheduleNext(s, review({ quality: "exact" }));
    expect(next.intervalDays).toBeLessThan(MASTERED_INTERVAL_DAYS);
    expect(next.status).toBe("reviewing");
  });

  it("mastered verses still resurface with a future dueAt", () => {
    const mastered = reviewing({
      status: "mastered",
      intervalDays: 40,
      ease: 2.5,
    });
    const next = scheduleNext(mastered, review({ quality: "exact" }));
    expect(next.status).toBe("mastered");
    expect(next.dueAt).toBeGreaterThan(NOW);
  });
});

describe("interval fuzz", () => {
  it("is deterministic for identical input", () => {
    const s = reviewing({ intervalDays: 10, ease: 2.3 });
    const a = scheduleNext(s, review({ quality: "exact" }));
    const b = scheduleNext(s, review({ quality: "exact" }));
    expect(a.dueAt).toBe(b.dueAt);
  });

  it("keeps the due date within +/-10% of the interval", () => {
    for (const intervalDays of [1, 4, 12] as const) {
      for (const accuracy of [55, 72, 88, 100]) {
        const s = reviewing({ intervalDays, ease: 2.4 });
        const next = scheduleNext(s, review({ quality: "exact", accuracy }));
        const effective = effectiveIntervalDays(next.dueAt, NOW);
        expect(effective).toBeGreaterThanOrEqual(next.intervalDays * 0.9);
        expect(effective).toBeLessThanOrEqual(next.intervalDays * 1.1);
      }
    }
  });

  it("leaves within-session retries due immediately (no fuzz on 0 interval)", () => {
    const next = scheduleNext(learningAt(1), review({ quality: "close" }));
    expect(next.dueAt).toBe(NOW);
  });
});
