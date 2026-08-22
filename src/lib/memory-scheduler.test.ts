import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  EASE_MAX,
  EASE_MIN,
  EASE_START,
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  MIN_LEARNING_LOCK_MS,
  requiredRepsFor,
  SUPPORT_BANDS,
  initialSchedule,
  isDueForLearning,
  isDueForLibrary,
  isDueForReview,
  isLearningLocked,
  nextLearningSessionDueAt,
  dueAtInCalendarDays,
  dueIndexUntil,
  scheduleNext,
  SHORT_VERSE_WORDS,
  LONG_VERSE_WORDS,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";

const NOW = 1_700_000_000_000;

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
    earlyReviewApplied: false,
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
    earlyReviewApplied: false,
    ...overrides,
  };
}

/** UTC timestamp of local midnight on the day containing `t`. */
function localMidnightUtc(t: number, tzOffsetMinutes: number): number {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  return Math.floor((t - offsetMs) / DAY_MS) * DAY_MS + offsetMs;
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
      earlyReviewApplied: false,
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
    let sessionNow = NOW;
    // Each band only clears after its required exact reps; walk them all.
    // Guided/Challenge clears soft-lock until the next day — advance `now`.
    for (let stage = 0; stage <= MAX_LEARN_STAGE; stage += 1) {
      const required = SUPPORT_BANDS[stage].requiredReps;
      for (let rep = 1; rep < required; rep += 1) {
        s = scheduleNext(s, review({ quality: "exact", now: sessionNow }));
        expect(s.status).toBe("learning");
        expect(s.learnStage).toBe(stage);
        expect(s.stageReps).toBe(rep);
        expect(s.intervalDays).toBe(0);
        expect(s.dueAt).toBe(sessionNow);
      }
      s = scheduleNext(s, review({ quality: "exact", now: sessionNow }));
      if (stage < MAX_LEARN_STAGE) {
        expect(s.status).toBe("learning");
        expect(s.learnStage).toBe(stage + 1);
        expect(s.stageReps).toBe(0);
        expect(s.intervalDays).toBe(0);
        if (stage === 1 || stage === 2) {
          expect(s.dueAt).toBe(nextLearningSessionDueAt(sessionNow));
          sessionNow = s.dueAt;
        } else {
          expect(s.dueAt).toBe(sessionNow);
        }
      }
    }
    expect(s.status).toBe("reviewing");
    expect(s.learnStage).toBe(MAX_LEARN_STAGE);
    expect(s.stageReps).toBe(0);
    expect(s.intervalDays).toBe(1);
    expect(s.dueAt).toBe(sessionNow + DAY_MS);
  });
});

describe("learning phase grades", () => {
  it("Guided needs 3 exacts (short verse): reps 1–2 hold the band, the 3rd advances and locks", () => {
    let s = learningAt(1);
    for (let rep = 1; rep <= 2; rep += 1) {
      s = scheduleNext(s, review({ quality: "exact" }));
      expect(s.status).toBe("learning");
      expect(s.learnStage).toBe(1);
      expect(s.stageReps).toBe(rep);
      expect(s.dueAt).toBe(NOW);
    }
    // Third exact clears Guided → Challenge soft-locked until tomorrow.
    s = scheduleNext(s, review({ quality: "exact" }));
    expect(s.status).toBe("learning");
    expect(s.learnStage).toBe(2);
    expect(s.stageReps).toBe(0);
    expect(s.dueAt).toBe(nextLearningSessionDueAt(NOW));
    expect(s.consecutiveCorrect).toBe(3);
    expect(isLearningLocked(s, NOW)).toBe(true);
    expect(isDueForLearning(s, NOW)).toBe(false);
  });

  it("Challenge needs 4 exacts (short verse) before advancing to From Memory (locked)", () => {
    let s = learningAt(2);
    for (let rep = 1; rep <= 3; rep += 1) {
      s = scheduleNext(s, review({ quality: "exact" }));
      expect(s.learnStage).toBe(2);
      expect(s.stageReps).toBe(rep);
      expect(s.dueAt).toBe(NOW);
    }
    s = scheduleNext(s, review({ quality: "exact" }));
    expect(s.learnStage).toBe(3);
    expect(s.stageReps).toBe(0);
    expect(s.dueAt).toBe(nextLearningSessionDueAt(NOW));
    expect(isLearningLocked(s, NOW)).toBe(true);
  });

  it("Read clear advances to Guided same day (no soft lock)", () => {
    const next = scheduleNext(learningAt(0, 0), review({ quality: "exact" }));
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(0);
    expect(next.dueAt).toBe(NOW);
    expect(isDueForLearning(next, NOW)).toBe(true);
  });

  it("Guided needs 5 exacts for a long verse (>=24 words) then locks", () => {
    let s = learningAt(1);
    for (let rep = 1; rep <= 4; rep += 1) {
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
    expect(s.dueAt).toBe(nextLearningSessionDueAt(NOW));
  });

  it("Challenge needs 5 exacts for a long verse (>=24 words) then locks", () => {
    let s = learningAt(2);
    for (let rep = 1; rep <= 4; rep += 1) {
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
    expect(s.dueAt).toBe(nextLearningSessionDueAt(NOW));
  });

  it("a passing but imperfect recall holds the band and its banked reps", () => {
    const next = scheduleNext(
      learningAt(2, 3),
      review({ quality: "close", accuracy: 70 }),
    );
    expect(next.learnStage).toBe(2);
    expect(next.stageReps).toBe(3);
    expect(next.status).toBe("learning");
    expect(next.dueAt).toBe(NOW);
  });

  it("a near-perfect recall banks learning progress", () => {
    const next = scheduleNext(
      learningAt(2, 2),
      review({ quality: "close", accuracy: 92 }),
    );
    expect(next.learnStage).toBe(2);
    expect(next.stageReps).toBe(3);
    expect(next.status).toBe("learning");
  });

  it("From Memory does not bank a near-perfect close recall", () => {
    const next = scheduleNext(
      learningAt(3, 0),
      review({ quality: "close", accuracy: 92 }),
    );
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(0);
    expect(next.status).toBe("learning");
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
    // requiredRepsFor(1, 24) = 5, so landing reps = max(0, 5-1) = 4.
    const next = scheduleNext(
      learningAt(2, 0),
      review({ quality: "off", wordCount: LONG_VERSE_WORDS }),
    );
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(4);
    expect(next.consecutiveCorrect).toBe(0);
  });

  it("off at Read 0/0 stays at 0/0 (floor)", () => {
    const next = scheduleNext(learningAt(0, 0), review({ quality: "off" }));
    expect(next.learnStage).toBe(0);
    expect(next.stageReps).toBe(0);
    expect(next.consecutiveCorrect).toBe(0);
  });

  it("an exact at From Memory banks a rep without graduating early", () => {
    const next = scheduleNext(learningAt(3, 0), review({ quality: "exact" }));
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(1);
  });

  it("the second From Memory exact graduates even on a long verse", () => {
    const next = scheduleNext(
      learningAt(3, 1),
      review({ quality: "exact", wordCount: LONG_VERSE_WORDS }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });

  it("clearing the last From Memory rep graduates to reviewing with a 1-day interval", () => {
    const lastRep = requiredRepsFor(MAX_LEARN_STAGE) - 1;
    const next = scheduleNext(
      learningAt(3, lastRep),
      review({ quality: "exact" }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
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
    expect(next.dueAt).toBe(NOW + Math.round(5 * 2.3) * DAY_MS);
  });

  it("close multiplies interval by ease * 0.8 and leaves ease unchanged", () => {
    const s = reviewing({ intervalDays: 5, ease: 2.3, consecutiveCorrect: 3 });
    const next = scheduleNext(s, review({ quality: "close" }));
    expect(next.intervalDays).toBeCloseTo(5 * 2.3 * 0.8, 5);
    expect(next.ease).toBeCloseTo(2.3, 5);
    expect(next.consecutiveCorrect).toBe(3);
    expect(next.status).toBe("reviewing");
    expect(next.dueAt).toBe(NOW + Math.round(5 * 2.3 * 0.8) * DAY_MS);
  });

  it("accuracy under 60% lapses: ease -0.2, lapses++, back to Guided learning", () => {
    const s = reviewing({ intervalDays: 20, ease: 2.3, lapses: 1 });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 16, mode: "review" }),
    );
    expect(next.intervalDays).toBe(0);
    expect(next.dueAt).toBe(NOW);
    expect(next.ease).toBeCloseTo(2.1, 5);
    expect(next.lapses).toBe(2);
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(1);
    expect(next.stageReps).toBe(0);
    expect(next.consecutiveCorrect).toBe(0);
    expect(next.earlyReviewApplied).toBe(false);
  });

  it("accuracy at 60%+ stays reviewing with close-style growth even if quality is off", () => {
    const s = reviewing({ intervalDays: 5, ease: 2.3, consecutiveCorrect: 3 });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 70, mode: "review" }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBeCloseTo(5 * 2.3 * 0.8, 5);
    expect(next.ease).toBeCloseTo(2.3, 5);
    expect(next.consecutiveCorrect).toBe(3);
    expect(next.lapses).toBe(0);
  });
});

describe("early review boost (once per interval)", () => {
  it("first successful early review grows the interval from now", () => {
    const s = reviewing({
      intervalDays: 5,
      ease: 2.3,
      dueAt: NOW + 2 * DAY_MS,
      earlyReviewApplied: false,
    });
    const next = scheduleNext(s, review({ quality: "exact" }));
    expect(next.intervalDays).toBeCloseTo(5 * 2.3, 5);
    expect(next.dueAt).toBeGreaterThan(NOW);
    expect(next.earlyReviewApplied).toBe(true);
  });

  it("second early success leaves interval and dueAt unchanged", () => {
    const first = scheduleNext(
      reviewing({
        intervalDays: 5,
        ease: 2.3,
        dueAt: NOW + 2 * DAY_MS,
        earlyReviewApplied: false,
      }),
      review({ quality: "exact" }),
    );
    const second = scheduleNext(
      first,
      review({ quality: "exact", now: NOW + DAY_MS, accuracy: 99 }),
    );
    expect(second.intervalDays).toBe(first.intervalDays);
    expect(second.dueAt).toBe(first.dueAt);
    expect(second.ease).toBe(first.ease);
    expect(second.consecutiveCorrect).toBe(first.consecutiveCorrect);
    expect(second.earlyReviewApplied).toBe(true);
  });

  it("due review after an early boost grows again and clears the flag", () => {
    const afterEarly = scheduleNext(
      reviewing({
        intervalDays: 5,
        ease: 2.3,
        dueAt: NOW + 2 * DAY_MS,
        earlyReviewApplied: false,
      }),
      review({ quality: "exact" }),
    );
    const whenDue = scheduleNext(
      afterEarly,
      review({ quality: "exact", now: afterEarly.dueAt }),
    );
    expect(whenDue.intervalDays).toBeCloseTo(
      afterEarly.intervalDays * afterEarly.ease,
      5,
    );
    expect(whenDue.earlyReviewApplied).toBe(false);
    expect(whenDue.dueAt).toBeGreaterThan(afterEarly.dueAt);
  });

  it("early close also consumes the one-time boost", () => {
    const s = reviewing({
      intervalDays: 5,
      ease: 2.3,
      dueAt: NOW + DAY_MS,
      earlyReviewApplied: false,
      consecutiveCorrect: 3,
    });
    const first = scheduleNext(s, review({ quality: "close" }));
    expect(first.earlyReviewApplied).toBe(true);
    expect(first.intervalDays).toBeCloseTo(5 * 2.3 * 0.8, 5);

    const second = scheduleNext(
      first,
      review({ quality: "close", now: NOW + 1 }),
    );
    expect(second).toEqual(first);
  });

  it("early low-accuracy miss still lapses and clears the early-boost flag", () => {
    const s = reviewing({
      intervalDays: 10,
      ease: 2.3,
      dueAt: NOW + DAY_MS,
      earlyReviewApplied: true,
      lapses: 0,
    });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 40, mode: "review" }),
    );
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(1);
    expect(next.earlyReviewApplied).toBe(false);
    expect(next.lapses).toBe(1);
  });
});

describe("ease clamping", () => {
  it("floors ease at EASE_MIN on repeated lapses", () => {
    const s = reviewing({ ease: EASE_MIN + 0.1 });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 10, mode: "review" }),
    );
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

describe("calendar due dates", () => {
  const tz = 420; // UTC-7

  it("is deterministic for identical input", () => {
    const s = reviewing({ intervalDays: 10, ease: 2.3 });
    const a = scheduleNext(s, review({ quality: "exact" }));
    const b = scheduleNext(s, review({ quality: "exact" }));
    expect(a.dueAt).toBe(b.dueAt);
  });

  it("lands a 1-day review at next local midnight, not 24 hours later", () => {
    const threePm = localMidnightUtc(NOW, tz) + 15 * 60 * 60 * 1000;
    const next = scheduleNext(
      reviewing({ intervalDays: 1, ease: 1 }),
      review({ quality: "exact", now: threePm, tzOffsetMinutes: tz }),
    );
    expect(next.dueAt).toBe(dueAtInCalendarDays(threePm, 1, tz));
    expect(next.dueAt).toBe(localMidnightUtc(threePm, tz) + DAY_MS);
    expect(next.dueAt - threePm).toBeLessThan(DAY_MS);
  });

  it("keeps a late-night 1-day review at least 6 hours out", () => {
    const elevenPm = localMidnightUtc(NOW, tz) + 23 * 60 * 60 * 1000;
    const next = scheduleNext(
      reviewing({ intervalDays: 1, ease: 1 }),
      review({ quality: "exact", now: elevenPm, tzOffsetMinutes: tz }),
    );
    expect(next.dueAt - elevenPm).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
    expect(next.dueAt).toBe(elevenPm + 6 * 60 * 60 * 1000);
  });

  it("queues a multi-day interval at local midnight N days later", () => {
    const threePm = localMidnightUtc(NOW, tz) + 15 * 60 * 60 * 1000;
    const next = scheduleNext(
      reviewing({ intervalDays: 7, ease: 1 }),
      review({ quality: "exact", now: threePm, tzOffsetMinutes: tz }),
    );
    expect(next.dueAt).toBe(localMidnightUtc(threePm, tz) + 7 * DAY_MS);
  });

  it("does not shift a multi-day due date by the 6-hour floor", () => {
    const elevenPm = localMidnightUtc(NOW, tz) + 23 * 60 * 60 * 1000;
    const next = scheduleNext(
      reviewing({ intervalDays: 7, ease: 1 }),
      review({ quality: "exact", now: elevenPm, tzOffsetMinutes: tz }),
    );
    expect(next.dueAt).toBe(localMidnightUtc(elevenPm, tz) + 7 * DAY_MS);
    expect(next.dueAt - elevenPm).toBeGreaterThan(6 * 60 * 60 * 1000);
  });

  it("falls back to a rolling day when the timezone is unknown", () => {
    const next = scheduleNext(
      reviewing({ intervalDays: 3, ease: 1 }),
      review({ quality: "exact" }),
    );
    expect(next.dueAt).toBe(NOW + 3 * DAY_MS);
  });

  it("does not vary dueAt with accuracy (no fuzz)", () => {
    const s = reviewing({ intervalDays: 4, ease: 2.4 });
    const dues = [72, 88, 100].map(
      (accuracy) =>
        scheduleNext(s, review({ quality: "exact", accuracy })).dueAt,
    );
    expect(new Set(dues).size).toBe(1);
  });

  it("leaves within-session retries due immediately", () => {
    const next = scheduleNext(
      learningAt(1),
      review({ quality: "close", accuracy: 70 }),
    );
    expect(next.dueAt).toBe(NOW);
  });
});

describe("requiredRepsFor length curve", () => {
  it("returns 1 for Read (stage 0) regardless of wordCount", () => {
    expect(requiredRepsFor(0)).toBe(1);
    expect(requiredRepsFor(0, LONG_VERSE_WORDS)).toBe(1);
  });

  it("returns short-verse minima (3 / 4 / 2) when wordCount is omitted", () => {
    expect(requiredRepsFor(1)).toBe(3);
    expect(requiredRepsFor(2)).toBe(4);
    expect(requiredRepsFor(3)).toBe(2);
  });

  it("returns short-verse minima for wordCount equal to SHORT_VERSE_WORDS", () => {
    expect(requiredRepsFor(1, SHORT_VERSE_WORDS)).toBe(3);
    expect(requiredRepsFor(2, SHORT_VERSE_WORDS)).toBe(4);
    expect(requiredRepsFor(3, SHORT_VERSE_WORDS)).toBe(2);
  });

  it("returns long-verse maxima (5 / 5) with From Memory still at 2", () => {
    expect(requiredRepsFor(1, LONG_VERSE_WORDS)).toBe(5);
    expect(requiredRepsFor(2, LONG_VERSE_WORDS)).toBe(5);
    expect(requiredRepsFor(3, LONG_VERSE_WORDS)).toBe(2);
    expect(requiredRepsFor(1, 50)).toBe(5);
    expect(requiredRepsFor(2, 50)).toBe(5);
    expect(requiredRepsFor(3, 50)).toBe(2);
  });

  it("interpolates Guided/Challenge at a midpoint (17 words, t=0.5)", () => {
    // Guided: 3 + (5-3)*0.5 = 4; Challenge: 4 + (5-4)*0.5 = 4.5 → 5;
    // From Memory is always 2.
    expect(requiredRepsFor(1, 17)).toBe(4);
    expect(requiredRepsFor(2, 17)).toBe(5);
    expect(requiredRepsFor(3, 17)).toBe(2);
  });
});

describe("isDueForReview", () => {
  it("excludes new and learning verses even when dueAt is now", () => {
    expect(isDueForReview(initialSchedule(NOW), NOW)).toBe(false);
    expect(isDueForReview(learningAt(2), NOW)).toBe(false);
  });

  it("includes reviewing and mastered verses when dueAt <= now", () => {
    expect(isDueForReview(reviewing({ dueAt: NOW }), NOW)).toBe(true);
    expect(isDueForReview(reviewing({ dueAt: NOW - 1 }), NOW)).toBe(true);
    expect(
      isDueForReview(
        reviewing({ status: "mastered", dueAt: NOW, intervalDays: 40 }),
        NOW,
      ),
    ).toBe(true);
  });

  it("excludes reviewing verses scheduled in the future", () => {
    expect(isDueForReview(reviewing({ dueAt: NOW + DAY_MS }), NOW)).toBe(false);
  });
});

describe("isDueForLearning / isLearningLocked", () => {
  it("treats available learning verses as due for learning, not locked", () => {
    expect(isDueForLearning(learningAt(1), NOW)).toBe(true);
    expect(isLearningLocked(learningAt(1), NOW)).toBe(false);
  });

  it("excludes hearted-but-not-started new verses from learning due", () => {
    expect(isDueForLearning(initialSchedule(NOW), NOW)).toBe(false);
    expect(isLearningLocked(initialSchedule(NOW), NOW)).toBe(false);
  });

  it("never locks unstarted new verses, even if dueAt is ahead of the UI clock", () => {
    const seededAhead = initialSchedule(NOW + 5 * 60 * 1000);
    expect(isLearningLocked(seededAhead, NOW)).toBe(false);
    expect(isDueForLearning(seededAhead, NOW)).toBe(false);
  });

  it("soft-locks learning verses with a future dueAt", () => {
    const locked = learningAt(2);
    locked.dueAt = NOW + DAY_MS;
    expect(isDueForLearning(locked, NOW)).toBe(false);
    expect(isLearningLocked(locked, NOW)).toBe(true);
    expect(isDueForLearning(locked, NOW + DAY_MS)).toBe(true);
  });

  it("never marks reviewing verses as due for learning", () => {
    expect(isDueForLearning(reviewing({ dueAt: NOW }), NOW)).toBe(false);
    expect(isLearningLocked(reviewing({ dueAt: NOW + DAY_MS }), NOW)).toBe(
      false,
    );
  });

  it("opens the next session at the start of the learner's next local day", () => {
    const tz = 420; // UTC-7
    const localDayOf = (t: number) => Math.floor((t - tz * 60_000) / DAY_MS);

    // Every local hour of the day reopens on the *next* local day — the
    // six-hour floor pushes a late-night session past midnight without ever
    // skipping a day.
    for (let hour = 0; hour < 24; hour += 1) {
      const now = localMidnightUtc(NOW, tz) + hour * 60 * 60 * 1000;
      const due = nextLearningSessionDueAt(now, tz);
      expect(localDayOf(due)).toBe(localDayOf(now) + 1);
      expect(due - now).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
      expect(due - now).toBeLessThanOrEqual(DAY_MS);
    }
  });

  it("reopens an evening session the next morning, not 24 hours later", () => {
    const tz = 420;
    const eightPm = localMidnightUtc(NOW, tz) + 20 * 60 * 60 * 1000;
    const due = nextLearningSessionDueAt(eightPm, tz);
    expect(due - eightPm).toBeLessThan(DAY_MS / 2);
  });

  it("falls back to a rolling day when the timezone is unknown", () => {
    expect(nextLearningSessionDueAt(NOW)).toBe(NOW + DAY_MS);
  });

  it("does not lock a just-recorded rep when the caller's clock lags", () => {
    // Attempts persist with a fresh Date.now() while the UI compares against
    // a frozen session clock, so `dueAt` can sit slightly ahead of `now` on
    // already-stamped rows. That must not read as a soft lock.
    const staleNow = NOW - 5 * 60 * 1000;
    const justPracticed = scheduleNext(
      learningAt(1, 0),
      review({ quality: "exact" }),
    );
    expect(justPracticed.dueAt).toBe(NOW);
    expect(isLearningLocked(justPracticed, staleNow)).toBe(false);
    expect(isDueForLearning(justPracticed, staleNow)).toBe(true);
  });

  it("still locks a session-ending clear against a lagging clock", () => {
    const staleNow = NOW - 5 * 60 * 1000;
    const locked = learningAt(2);
    locked.dueAt = nextLearningSessionDueAt(NOW);
    expect(isLearningLocked(locked, staleNow)).toBe(true);
    expect(isDueForLearning(locked, staleNow)).toBe(false);
  });

  it("does not drop in-progress learning when the caller clock is hours stale", () => {
    const staleNow = NOW - 3 * 60 * 60 * 1000;
    const inProgress = { ...learningAt(1), lastReviewedAt: NOW, dueAt: NOW };
    expect(isLearningLocked(inProgress, staleNow)).toBe(false);
    expect(isDueForLearning(inProgress, staleNow)).toBe(true);
  });

  it("still locks a session-ending clear against an hours-stale clock", () => {
    const staleNow = NOW - 3 * 60 * 60 * 1000;
    const locked = {
      ...learningAt(2),
      lastReviewedAt: NOW,
      dueAt: nextLearningSessionDueAt(NOW),
    };
    expect(isLearningLocked(locked, staleNow)).toBe(true);
    expect(isDueForLearning(locked, staleNow)).toBe(false);
  });

  it("unlocks a session-ended verse once now reaches dueAt", () => {
    const locked = {
      ...learningAt(2),
      lastReviewedAt: NOW,
      dueAt: NOW + DAY_MS,
    };
    expect(isDueForLearning(locked, NOW)).toBe(false);
    expect(isDueForLearning(locked, NOW + DAY_MS)).toBe(true);
  });

  it("keeps the original dueAt on in-progress reps so a frozen query clock still sees the verse", () => {
    const originalDueAt = NOW - 2 * 60 * 60 * 1000;
    const next = scheduleNext(
      { ...learningAt(2, 0), dueAt: originalDueAt },
      review({ quality: "exact" }),
    );
    expect(next.dueAt).toBe(originalDueAt);
    const frozenNow = originalDueAt + 60 * 1000;
    expect(next.dueAt).toBeLessThanOrEqual(frozenNow);
    expect(isDueForLearning({ ...next, lastReviewedAt: NOW }, frozenNow)).toBe(
      true,
    );
  });

  it("due-index scan bound includes in-progress stamps ahead of a frozen now", () => {
    const frozenNow = NOW - 45 * 60 * 1000;
    expect(dueIndexUntil(frozenNow)).toBe(frozenNow + MIN_LEARNING_LOCK_MS);
    expect(NOW).toBeLessThanOrEqual(dueIndexUntil(frozenNow));
    expect(
      isDueForLearning(
        { ...learningAt(2), lastReviewedAt: NOW, dueAt: NOW },
        frozenNow,
      ),
    ).toBe(true);
    expect(
      isDueForLearning(
        {
          ...learningAt(2),
          lastReviewedAt: NOW,
          dueAt: nextLearningSessionDueAt(NOW),
        },
        frozenNow,
      ),
    ).toBe(false);
  });
});

describe("isDueForLibrary", () => {
  it("does not treat new verses as due", () => {
    expect(isDueForLibrary(initialSchedule(NOW), NOW)).toBe(false);
  });

  it("includes due review verses", () => {
    expect(isDueForLibrary(reviewing({ dueAt: NOW }), NOW)).toBe(true);
  });

  it("includes unlocked learning verses", () => {
    expect(isDueForLibrary(learningAt(1), NOW)).toBe(true);
  });

  it("excludes locked learning verses", () => {
    const locked = learningAt(2);
    locked.dueAt = NOW + DAY_MS;
    expect(isDueForLibrary(locked, NOW)).toBe(false);
  });
});
