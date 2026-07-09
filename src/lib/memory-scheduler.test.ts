import { describe, expect, it } from "vitest";

import {
  EASE_MAX,
  EASE_MIN,
  EASE_START,
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  requiredRepsFor,
  SUPPORT_BANDS,
  initialSchedule,
  scheduleNext,
  SHORT_VERSE_WORDS,
  LONG_VERSE_WORDS,
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

function learningAt(stage: number, stageReps = 0): MemorySchedule {
  return {
    status: "learning",
    learnStage: stage,
    stageReps,
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
    stageReps: 0,
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
      stageReps: 0,
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

  it("walks every band by its required reps then graduates to reviewing", () => {
    let s = initialSchedule(NOW);
    // Each band only clears after its required exact reps; walk them all.
    for (let stage = 0; stage <= MAX_LEARN_STAGE; stage += 1) {
      const required = SUPPORT_BANDS[stage].requiredReps;
      // Reps 1..required-1 bank on the band with a rising stageReps counter.
      for (let rep = 1; rep < required; rep += 1) {
        s = scheduleNext(s, review({ quality: "exact" }));
        expect(s.status).toBe("learning");
        expect(s.learnStage).toBe(stage);
        expect(s.stageReps).toBe(rep);
        expect(s.intervalDays).toBe(0);
        expect(s.dueAt).toBe(NOW);
      }
      // The required-th rep clears the band.
      s = scheduleNext(s, review({ quality: "exact" }));
      if (stage < MAX_LEARN_STAGE) {
        expect(s.status).toBe("learning");
        expect(s.learnStage).toBe(stage + 1);
        expect(s.stageReps).toBe(0);
        expect(s.intervalDays).toBe(0);
        expect(s.dueAt).toBe(NOW);
      }
    }
    // The final band's clearing rep graduates into reviewing.
    expect(s.status).toBe("reviewing");
    expect(s.learnStage).toBe(MAX_LEARN_STAGE);
    expect(s.stageReps).toBe(0);
    expect(s.intervalDays).toBe(1);
  });
});

describe("learning phase grades", () => {
  it("Guided needs 3 exacts (short verse): reps 1–2 hold the band, the 3rd advances", () => {
    let s = learningAt(1);
    for (let rep = 1; rep <= 2; rep += 1) {
      s = scheduleNext(s, review({ quality: "exact" }));
      expect(s.status).toBe("learning");
      expect(s.learnStage).toBe(1);
      expect(s.stageReps).toBe(rep);
    }
    // Third exact clears Guided and advances to Challenge with a reset counter.
    s = scheduleNext(s, review({ quality: "exact" }));
    expect(s.status).toBe("learning");
    expect(s.learnStage).toBe(2);
    expect(s.stageReps).toBe(0);
    expect(s.consecutiveCorrect).toBe(3);
  });

  it("Challenge needs 5 exacts (short verse) before advancing to From Memory", () => {
    let s = learningAt(2);
    for (let rep = 1; rep <= 4; rep += 1) {
      s = scheduleNext(s, review({ quality: "exact" }));
      expect(s.learnStage).toBe(2);
      expect(s.stageReps).toBe(rep);
    }
    s = scheduleNext(s, review({ quality: "exact" }));
    expect(s.learnStage).toBe(3);
    expect(s.stageReps).toBe(0);
  });

  it("Guided needs 7 exacts for a long verse (>=24 words)", () => {
    let s = learningAt(1);
    for (let rep = 1; rep <= 6; rep += 1) {
      s = scheduleNext(
        s,
        review({ quality: "exact", wordCount: LONG_VERSE_WORDS }),
      );
      expect(s.learnStage).toBe(1);
      expect(s.stageReps).toBe(rep);
    }
    s = scheduleNext(
      s,
      review({ quality: "exact", wordCount: LONG_VERSE_WORDS }),
    );
    expect(s.learnStage).toBe(2);
    expect(s.stageReps).toBe(0);
  });

  it("Challenge needs 12 exacts for a long verse (>=24 words)", () => {
    let s = learningAt(2);
    for (let rep = 1; rep <= 11; rep += 1) {
      s = scheduleNext(
        s,
        review({ quality: "exact", wordCount: LONG_VERSE_WORDS }),
      );
      expect(s.learnStage).toBe(2);
      expect(s.stageReps).toBe(rep);
    }
    s = scheduleNext(
      s,
      review({ quality: "exact", wordCount: LONG_VERSE_WORDS }),
    );
    expect(s.learnStage).toBe(3);
    expect(s.stageReps).toBe(0);
  });

  it("close holds the band and its banked reps", () => {
    const next = scheduleNext(learningAt(2, 3), review({ quality: "close" }));
    expect(next.learnStage).toBe(2);
    expect(next.stageReps).toBe(3);
    expect(next.status).toBe("learning");
    expect(next.dueAt).toBe(NOW);
  });

  it("off mid-band: loses one banked rep and stays on the band", () => {
    // Guided (stage 1) with 3 reps → Guided with 2
    const next = scheduleNext(learningAt(1, 3), review({ quality: "off" }));
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(2);
    expect(next.consecutiveCorrect).toBe(0);
    expect(next.status).toBe("learning");
    expect(next.dueAt).toBe(NOW);
  });

  it("off at 0 reps drops one band, landing at requiredRepsFor(prev) - 1", () => {
    // Guided (stage 1) at 0 reps → Read (stage 0) at max(0, 1-1) = 0
    const next = scheduleNext(learningAt(1, 0), review({ quality: "off" }));
    expect(next.learnStage).toBe(0);
    expect(next.stageReps).toBe(0);
    expect(next.consecutiveCorrect).toBe(0);
  });

  it("off at 0 reps uses wordCount when computing the landing stageReps", () => {
    // Challenge (stage 2) at 0 reps, long verse: drop to Guided (stage 1).
    // requiredRepsFor(1, 24) = 7, so landing reps = max(0, 7-1) = 6.
    const next = scheduleNext(
      learningAt(2, 0),
      review({ quality: "off", wordCount: LONG_VERSE_WORDS }),
    );
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(6);
    expect(next.consecutiveCorrect).toBe(0);
  });

  it("off at Read 0/0 stays at 0/0 (floor)", () => {
    const next = scheduleNext(learningAt(0, 0), review({ quality: "off" }));
    expect(next.learnStage).toBe(0);
    expect(next.stageReps).toBe(0);
    expect(next.consecutiveCorrect).toBe(0);
  });

  it("an exact at From Memory graduates to reviewing with a 1-day interval", () => {
    const next = scheduleNext(learningAt(3, 0), review({ quality: "exact" }));
    expect(next.status).toBe("reviewing");
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(0);
    expect(next.intervalDays).toBe(1);
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

describe("requiredRepsFor length curve", () => {
  it("returns 1 for Read (stage 0) and From Memory (stage 3) regardless of wordCount", () => {
    expect(requiredRepsFor(0)).toBe(1);
    expect(requiredRepsFor(3)).toBe(1);
    expect(requiredRepsFor(0, LONG_VERSE_WORDS)).toBe(1);
    expect(requiredRepsFor(3, LONG_VERSE_WORDS)).toBe(1);
  });

  it("returns short-verse minima (3 / 5) when wordCount is omitted", () => {
    expect(requiredRepsFor(1)).toBe(3);
    expect(requiredRepsFor(2)).toBe(5);
  });

  it("returns short-verse minima for wordCount equal to SHORT_VERSE_WORDS", () => {
    expect(requiredRepsFor(1, SHORT_VERSE_WORDS)).toBe(3);
    expect(requiredRepsFor(2, SHORT_VERSE_WORDS)).toBe(5);
  });

  it("returns long-verse maxima (7 / 12) for wordCount >= LONG_VERSE_WORDS", () => {
    expect(requiredRepsFor(1, LONG_VERSE_WORDS)).toBe(7);
    expect(requiredRepsFor(2, LONG_VERSE_WORDS)).toBe(12);
    // Clamped above LONG_VERSE_WORDS
    expect(requiredRepsFor(1, 50)).toBe(7);
    expect(requiredRepsFor(2, 50)).toBe(12);
  });

  it("interpolates at a midpoint (17 words, t=0.5)", () => {
    // Guided: 3 + (7-3)*0.5 = 5; Challenge: 5 + (12-5)*0.5 = 8.5 → 9
    expect(requiredRepsFor(1, 17)).toBe(5);
    expect(requiredRepsFor(2, 17)).toBe(9);
  });
});
