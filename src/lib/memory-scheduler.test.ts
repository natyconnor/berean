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
  REVIEW_DAILY_INTERVAL_DAYS,
  REVIEW_DAILY_REPS,
  REVIEW_EVERY_OTHER_INTERVAL_DAYS,
  REVIEW_EVERY_OTHER_REPS,
  REVIEW_LAPSE_LEARN_STAGE,
  reviewGradeOutcome,
  SUPPORT_BANDS,
  initialSchedule,
  isDueForLearning,
  isDueForLibrary,
  isDueForReview,
  isLearningLocked,
  nextLearningSessionDueAt,
  dueAtInCalendarDays,
  dueIndexUntil,
  isFromMemoryGraduationAttempt,
  keepReviewingSchedule,
  planVerseAttemptSchedule,
  nextExactReviewIntervalDays,
  exactReviewsUntilMastered,
  reviewingPathStartEase,
  REVIEWING_PATH_START_EASE_CACHE_LIMIT,
  scheduleNext,
  SHORT_VERSE_WORDS,
  LONG_VERSE_WORDS,
  type MemorySchedule,
  type ReviewInput,
  type VerseAttemptPlanInput,
} from "./memory-scheduler";
import { memoryProgressFraction } from "./mastery-ring";

const NOW = 1_700_000_000_000;

function review(
  overrides: Partial<VerseAttemptPlanInput> = {},
): VerseAttemptPlanInput {
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

function reviewingBar(s: MemorySchedule): number {
  return memoryProgressFraction(
    s.status,
    s.learnStage,
    s.stageReps,
    s.intervalDays,
    undefined,
    s.ease,
  );
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

  it("the first From Memory recall banks a near-perfect close", () => {
    const next = scheduleNext(
      learningAt(3, 0),
      review({ quality: "close", accuracy: 92 }),
    );
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(1);
    expect(next.status).toBe("learning");
  });

  it("the graduating From Memory recall does not bank a near-perfect close", () => {
    const next = scheduleNext(
      learningAt(3, 1),
      review({ quality: "close", accuracy: 92 }),
    );
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.stageReps).toBe(1);
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

  it("60–84% on an off-path gap snaps to the path, then loses one step", () => {
    const s = reviewing({
      intervalDays: 16,
      ease: 2.3,
      consecutiveCorrect: 9,
      stageReps: 0,
      lapses: 4,
    });
    const next = scheduleNext(
      s,
      review({ quality: "close", accuracy: 70, mode: "review" }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBeCloseTo(4.6, 5);
    expect(next.ease).toBeCloseTo(2.35, 5);
    expect(next.stageReps).toBe(0);
    expect(next.consecutiveCorrect).toBe(8);
    expect(next.lapses).toBe(4);
    expect(next.dueAt).toBe(NOW + 5 * DAY_MS);
    expect(reviewingBar(next)).toBeCloseTo(8 / 11, 5);
  });

  it("85–99% grows a 4-day gap about halfway vs a perfect recall", () => {
    const s = reviewing({ intervalDays: 4, ease: 2.3, consecutiveCorrect: 3 });
    const exact = scheduleNext(s, review({ quality: "exact", mode: "review" }));
    const pass = scheduleNext(
      s,
      review({ quality: "close", accuracy: 90, mode: "review" }),
    );
    expect(exact.intervalDays).toBeCloseTo(9.2, 5);
    expect(exact.ease).toBeCloseTo(2.35, 5);
    expect(pass.intervalDays).toBe(7);
    expect(pass.ease).toBeCloseTo(2.3, 5);
    expect(pass.status).toBe("reviewing");
    expect(pass.dueAt).toBe(NOW + 7 * DAY_MS);
  });

  it("isFromMemoryGraduationAttempt is only the last From Memory rep", () => {
    expect(isFromMemoryGraduationAttempt(3, 0)).toBe(false);
    expect(isFromMemoryGraduationAttempt(3, 1)).toBe(true);
    expect(isFromMemoryGraduationAttempt(2, 3)).toBe(false);
  });

  it("under 60% with two banked reviews drops a verse to Learning", () => {
    const s = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: 2.3,
      lapses: 1,
      stageReps: 2,
    });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 16, mode: "review" }),
    );
    expect(next.intervalDays).toBe(0);
    expect(next.dueAt).toBe(NOW);
    expect(next.ease).toBeCloseTo(2.1, 5);
    expect(next.lapses).toBe(2);
    expect(next.status).toBe("learning");
    expect(next.learnStage).toBe(REVIEW_LAPSE_LEARN_STAGE);
    expect(next.stageReps).toBe(0);
    expect(next.consecutiveCorrect).toBe(0);
    expect(next.earlyReviewApplied).toBe(false);
  });

  it("treats accuracy 60–84% as a close miss even when quality is off", () => {
    const s = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: 2.3,
      stageReps: 2,
      consecutiveCorrect: 2,
    });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 70, mode: "review" }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(1);
    expect(next.ease).toBeCloseTo(2.3, 5);
    expect(next.lapses).toBe(0);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });
});

describe("reviewGradeOutcome", () => {
  it.each([
    ["exact", 93, "exact"],
    ["close", 99, "pass"],
    ["close", 85, "pass"],
    ["close", 84, "close"],
    ["close", 60, "close"],
    ["off", 59, "lapse"],
  ] as const)("bands %s at %i as %s", (quality, accuracy, outcome) => {
    expect(reviewGradeOutcome(quality, accuracy)).toBe(outcome);
  });
});

describe("post-graduation review ladder", () => {
  function exactAt(s: MemorySchedule, now: number): MemorySchedule {
    return scheduleNext(s, review({ quality: "exact", now, mode: "review" }));
  }

  it("previews the interval an exact recall would land on", () => {
    expect(
      nextExactReviewIntervalDays(
        reviewing({
          intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
          stageReps: 0,
        }),
      ),
    ).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(
      nextExactReviewIntervalDays(
        reviewing({
          intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
          stageReps: REVIEW_DAILY_REPS - 1,
        }),
      ),
    ).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(
      nextExactReviewIntervalDays(reviewing({ intervalDays: 5, ease: 2.3 })),
    ).toBeCloseTo(5 * 2.3);
  });

  it("keeps a newly graduated verse daily for REVIEW_DAILY_REPS exacts", () => {
    let s = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: 2.3,
      consecutiveCorrect: 0,
      stageReps: 0,
    });
    for (let i = 1; i < REVIEW_DAILY_REPS; i += 1) {
      s = exactAt(s, s.dueAt);
      expect(s.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
      expect(s.stageReps).toBe(i);
      expect(s.ease).toBe(2.3);
      expect(s.status).toBe("reviewing");
    }
    s = exactAt(s, s.dueAt);
    expect(s.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(s.stageReps).toBe(0);
    expect(s.ease).toBe(2.3);
  });

  it("then stays every other day for REVIEW_EVERY_OTHER_REPS exacts before growing", () => {
    let s = reviewing({
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      ease: 2.3,
      consecutiveCorrect: REVIEW_DAILY_REPS,
      stageReps: 0,
    });
    for (let i = 1; i < REVIEW_EVERY_OTHER_REPS; i += 1) {
      s = exactAt(s, s.dueAt);
      expect(s.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
      expect(s.stageReps).toBe(i);
      expect(s.ease).toBe(2.3);
    }
    s = exactAt(s, s.dueAt);
    expect(s.intervalDays).toBeCloseTo(
      REVIEW_EVERY_OTHER_INTERVAL_DAYS * 2.3,
      5,
    );
    expect(s.ease).toBeCloseTo(2.35, 5);
    expect(s.stageReps).toBe(0);
  });

  it("does not count a 60–84% recall toward the daily streak", () => {
    const s = reviewing({
      intervalDays: 1,
      ease: 2.3,
      consecutiveCorrect: 2,
      stageReps: 2,
    });
    const next = scheduleNext(
      s,
      review({ quality: "close", accuracy: 70, mode: "review" }),
    );
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(1);
    expect(next.consecutiveCorrect).toBe(1);
    expect(next.ease).toBe(2.3);
    expect(next.lapses).toBe(0);
    expect(next.status).toBe("reviewing");
    expect(next.dueAt).toBe(NOW + DAY_MS);
    expect(reviewingBar(next)).toBeGreaterThan(0);
    expect(reviewingBar(next)).toBeLessThan(reviewingBar(s));
  });

  it("counts remaining exacts to mastered from daily and every-other-day reps", () => {
    const fresh = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: EASE_START,
      stageReps: 0,
    });
    const fromStart = exactReviewsUntilMastered(fresh);
    expect(fromStart).toBeGreaterThan(
      REVIEW_DAILY_REPS + REVIEW_EVERY_OTHER_REPS,
    );
    expect(exactReviewsUntilMastered({ ...fresh, stageReps: 1 })).toBe(
      fromStart - 1,
    );
    expect(
      exactReviewsUntilMastered({
        ...fresh,
        intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
        stageReps: 0,
      }),
    ).toBe(fromStart - REVIEW_DAILY_REPS);
    expect(
      exactReviewsUntilMastered({
        intervalDays: MASTERED_INTERVAL_DAYS,
        ease: EASE_START,
        stageReps: 0,
      }),
    ).toBe(0);

    let s = fresh;
    expect(exactReviewsUntilMastered(s)).toBe(fromStart);
    for (let left = fromStart; left > 0; left -= 1) {
      s = exactAt(s, s.dueAt);
      expect(exactReviewsUntilMastered(s)).toBe(left - 1);
    }
    expect(s.status).toBe("mastered");
  });

  it("counts an 85–99% recall toward the daily streak like an exact", () => {
    const s = reviewing({
      intervalDays: 1,
      ease: 2.3,
      consecutiveCorrect: 2,
      stageReps: 2,
    });
    const next = scheduleNext(
      s,
      review({ quality: "close", accuracy: 90, mode: "review" }),
    );
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(3);
    expect(next.consecutiveCorrect).toBe(3);
    expect(next.ease).toBe(2.3);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });

  it("promotes on an 85–99% daily streak with the next stage's full gap", () => {
    const s = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: 2.3,
      consecutiveCorrect: 3,
      stageReps: REVIEW_DAILY_REPS - 1,
    });
    const next = scheduleNext(
      s,
      review({ quality: "close", accuracy: 90, mode: "review" }),
    );
    expect(next.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(next.stageReps).toBe(0);
    expect(next.ease).toBe(2.3);
    expect(next.status).toBe("reviewing");
  });

  it("promotes on an 85–99% every-other-day streak with the next stage's full gap", () => {
    const s = reviewing({
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      ease: 2.3,
      consecutiveCorrect: REVIEW_DAILY_REPS,
      stageReps: REVIEW_EVERY_OTHER_REPS - 1,
    });
    const next = scheduleNext(
      s,
      review({ quality: "close", accuracy: 90, mode: "review" }),
    );
    expect(next.intervalDays).toBeCloseTo(
      REVIEW_EVERY_OTHER_INTERVAL_DAYS * 2.3,
      5,
    );
    expect(next.ease).toBe(2.3);
    expect(next.stageReps).toBe(0);
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

  it("applies a 60–84% loss even before the due date", () => {
    const s = reviewing({
      intervalDays: REVIEW_EVERY_OTHER_INTERVAL_DAYS,
      ease: 2.3,
      stageReps: 2,
      consecutiveCorrect: 6,
      dueAt: NOW + DAY_MS,
      earlyReviewApplied: false,
    });
    const first = scheduleNext(s, review({ quality: "close", accuracy: 70 }));
    expect(first.status).toBe("reviewing");
    expect(first.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
    expect(first.stageReps).toBe(1);
    expect(first.ease).toBe(2.3);
    expect(first.earlyReviewApplied).toBe(false);
    expect(first.dueAt).toBe(NOW + 2 * DAY_MS);
  });

  it("early 85–99% grows halfway and consumes the one-time boost", () => {
    const s = reviewing({
      intervalDays: 5,
      ease: 2.3,
      dueAt: NOW + DAY_MS,
      earlyReviewApplied: false,
    });
    const next = scheduleNext(s, review({ quality: "close", accuracy: 88 }));
    expect(next.intervalDays).toBe(8);
    expect(next.ease).toBe(2.3);
    expect(next.earlyReviewApplied).toBe(true);
  });

  it("early under-60% drops a verse to Learning and clears the early-boost flag", () => {
    const s = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      stageReps: 1,
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
    expect(next.learnStage).toBe(REVIEW_LAPSE_LEARN_STAGE);
    expect(next.earlyReviewApplied).toBe(false);
    expect(next.lapses).toBe(1);
  });
});

describe("reviewing score bands", () => {
  const cases: Array<{
    name: string;
    schedule: Partial<MemorySchedule>;
    accuracy: number;
    quality?: ReviewInput["quality"];
    item?: ReviewInput["item"];
    expect: Partial<MemorySchedule> & { dueAt?: number };
  }> = [
    {
      name: "exact on daily stays daily and banks a rep",
      schedule: { intervalDays: 1, stageReps: 1, consecutiveCorrect: 1 },
      accuracy: 100,
      quality: "exact",
      expect: {
        status: "reviewing",
        intervalDays: 1,
        stageReps: 2,
        ease: 2.3,
        dueAt: NOW + DAY_MS,
      },
    },
    {
      name: "85–99% on daily stays daily and banks a rep",
      schedule: { intervalDays: 1, stageReps: 1, consecutiveCorrect: 1 },
      accuracy: 85,
      expect: {
        status: "reviewing",
        intervalDays: 1,
        stageReps: 2,
        ease: 2.3,
        dueAt: NOW + DAY_MS,
      },
    },
    {
      name: "60–84% on daily loses one rep and stays due tomorrow",
      schedule: { intervalDays: 1, stageReps: 3, consecutiveCorrect: 3 },
      accuracy: 60,
      expect: {
        status: "reviewing",
        intervalDays: 1,
        stageReps: 2,
        consecutiveCorrect: 2,
        ease: 2.3,
        lapses: 0,
        dueAt: NOW + DAY_MS,
      },
    },
    {
      name: "under 60% on an empty daily gap drops a verse to Learning",
      schedule: { intervalDays: 1, stageReps: 0, lapses: 0 },
      accuracy: 59,
      quality: "off",
      expect: {
        status: "learning",
        learnStage: REVIEW_LAPSE_LEARN_STAGE,
        intervalDays: 0,
        stageReps: 0,
        lapses: 1,
        dueAt: NOW,
      },
    },
    {
      name: "60–84% on a passage still steps back to every-other-day",
      schedule: {
        intervalDays: 40,
        status: "mastered",
        stageReps: 0,
        lapses: 2,
      },
      accuracy: 84,
      item: "passage",
      expect: {
        status: "reviewing",
        intervalDays: 2,
        stageReps: 0,
        ease: 2.3,
        lapses: 2,
        dueAt: NOW + 2 * DAY_MS,
      },
    },
    {
      name: "under 60% on a passage goes to daily, due tomorrow",
      schedule: { intervalDays: 12, status: "mastered", lapses: 1 },
      accuracy: 20,
      quality: "off",
      item: "passage",
      expect: {
        status: "reviewing",
        intervalDays: 1,
        stageReps: 0,
        lapses: 2,
        dueAt: NOW + DAY_MS,
      },
    },
    {
      name: "halfway growth is at least +1 day",
      schedule: { intervalDays: 3, ease: 1.3 },
      accuracy: 90,
      expect: {
        status: "reviewing",
        intervalDays: 4,
        ease: 1.3,
      },
    },
  ];

  it.each(cases)(
    "$name",
    ({ schedule, accuracy, quality, item, expect: wanted }) => {
      const next = scheduleNext(
        reviewing(schedule),
        review({
          quality: quality ?? "close",
          accuracy,
          mode: "review",
          item,
        }),
      );
      for (const [key, value] of Object.entries(wanted)) {
        expect(next[key as keyof MemorySchedule]).toBe(value);
      }
    },
  );
});

describe("keepReviewingSchedule", () => {
  it("keeps level, reps, ease and lapses, and lands due after the current gap", () => {
    const current = reviewing({
      intervalDays: 1,
      stageReps: 3,
      consecutiveCorrect: 2,
      ease: 2.4,
      lapses: 1,
    });
    const next = keepReviewingSchedule(current, { now: NOW });
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(1);
    expect(next.stageReps).toBe(3);
    expect(next.consecutiveCorrect).toBe(2);
    expect(next.ease).toBe(2.4);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });
});

describe("planVerseAttemptSchedule", () => {
  const dueDaily = reviewing({
    intervalDays: 1,
    stageReps: 3,
    consecutiveCorrect: 2,
    dueAt: NOW,
  });

  it("logs a First letters hold without patching", () => {
    const planned = planVerseAttemptSchedule(
      dueDaily,
      review({
        quality: "exact",
        accuracy: 100,
        mode: "review",
        holdSchedule: true,
      }),
    );
    expect(planned.patch).toBe(false);
    expect(planned.next).toEqual(dueDaily);
  });

  it("keeps a due From memory pass after a refresher, including 100%", () => {
    for (const grade of [
      { quality: "exact" as const, accuracy: 100 },
      { quality: "close" as const, accuracy: 90 },
    ]) {
      const planned = planVerseAttemptSchedule(
        dueDaily,
        review({ ...grade, mode: "review", refresherUsed: true }),
      );
      expect(planned.patch).toBe(true);
      expect(planned.next.stageReps).toBe(3);
      expect(planned.next.consecutiveCorrect).toBe(2);
      expect(planned.next.intervalDays).toBe(1);
      expect(planned.next.dueAt).toBe(NOW + DAY_MS);
    }
  });

  it("runs S1 scoring on a From memory miss after a refresher", () => {
    const close = planVerseAttemptSchedule(
      dueDaily,
      review({
        quality: "close",
        accuracy: 70,
        mode: "review",
        refresherUsed: true,
      }),
    );
    expect(close.next.status).toBe("reviewing");
    expect(close.next.stageReps).toBe(2);
    expect(close.next.intervalDays).toBe(1);
    expect(close.next.lapses).toBe(0);

    const lapse = planVerseAttemptSchedule(
      dueDaily,
      review({
        quality: "off",
        accuracy: 40,
        mode: "review",
        refresherUsed: true,
      }),
    );
    expect(lapse.next.status).toBe("reviewing");
    expect(lapse.next.intervalDays).toBe(1);
    expect(lapse.next.stageReps).toBe(0);
    expect(lapse.next.lapses).toBe(1);
  });

  it("grows the gap on a cold pass, unlike a refresher pass", () => {
    const cold = planVerseAttemptSchedule(
      dueDaily,
      review({ quality: "exact", accuracy: 100, mode: "review" }),
    );
    expect(cold.next.stageReps).toBe(0);
    expect(cold.next.intervalDays).toBe(REVIEW_EVERY_OTHER_INTERVAL_DAYS);
  });
});

describe("counted misses on the exact review path", () => {
  const startEases = Array.from(
    { length: 31 },
    (_, index) => (130 + index * 5) / 100,
  );

  function exactPath(startEase: number): MemorySchedule[] {
    const steps: MemorySchedule[] = [];
    let current = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: startEase,
      stageReps: 0,
      consecutiveCorrect: 0,
      status: "reviewing",
      lapses: 0,
      dueAt: NOW,
      earlyReviewApplied: false,
    });
    steps.push(current);
    while (
      steps.filter((step) => step.status === "mastered").length < 3 &&
      steps.length < 40
    ) {
      current = scheduleNext(
        current,
        review({
          quality: "exact",
          accuracy: 100,
          mode: "review",
          now: current.dueAt,
        }),
      );
      steps.push(current);
    }
    return steps;
  }

  function expectLandedOn(
    next: MemorySchedule,
    target: MemorySchedule,
    lapses: number,
  ) {
    expect(next.status).toBe(target.status);
    expect(next.intervalDays).toBeCloseTo(target.intervalDays, 5);
    expect(next.ease).toBeCloseTo(target.ease, 5);
    expect(next.stageReps).toBe(target.stageReps);
    expect(next.consecutiveCorrect).toBe(target.consecutiveCorrect);
    expect(next.learnStage).toBe(MAX_LEARN_STAGE);
    expect(next.lapses).toBe(lapses);
    expect(next.earlyReviewApplied).toBe(false);
    expect(next.dueAt).toBe(dueAtInCalendarDays(NOW, next.intervalDays));
    expect(reviewingBar(next)).toBeCloseTo(reviewingBar(target), 5);
  }

  it.each(startEases)(
    "loses one or three exact steps from start ease %s",
    (startEase) => {
      const steps = exactPath(startEase);
      const firstMastered = steps.findIndex(
        (step) => step.status === "mastered",
      );
      expect(firstMastered).toBeGreaterThan(3);

      for (let index = 0; index < steps.length; index += 1) {
        const banked =
          steps[index].status === "mastered" ? firstMastered : index;
        const state = { ...steps[index], lapses: 2 };

        const close = scheduleNext(
          state,
          review({ quality: "close", accuracy: 72, mode: "review", now: NOW }),
        );
        if (banked === 0) {
          expect(close.status).toBe("reviewing");
          expect(close.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
          expect(close.stageReps).toBe(0);
          expect(close.consecutiveCorrect).toBe(0);
          expect(close.ease).toBeCloseTo(startEase, 5);
          expect(close.lapses).toBe(2);
          expect(close.dueAt).toBe(NOW + DAY_MS);
          expect(reviewingBar(close)).toBe(0);
        } else {
          expectLandedOn(close, steps[banked - 1], 2);
        }

        const bad = scheduleNext(
          state,
          review({ quality: "off", accuracy: 40, mode: "review", now: NOW }),
        );
        if (banked < 3) {
          expect(bad.status).toBe("learning");
          expect(bad.learnStage).toBe(REVIEW_LAPSE_LEARN_STAGE);
          expect(bad.intervalDays).toBe(0);
          expect(bad.stageReps).toBe(0);
          expect(bad.consecutiveCorrect).toBe(0);
          expect(bad.dueAt).toBe(NOW);
          expect(bad.lapses).toBe(3);
          expect(bad.earlyReviewApplied).toBe(false);
          expect(bad.ease).toBeCloseTo(
            Math.min(EASE_MAX, Math.max(EASE_MIN, state.ease - 0.2)),
            5,
          );
        } else {
          expectLandedOn(bad, steps[banked - 3], 3);
        }
      }
    },
  );

  it("floors a close miss with no banked reviews at 0% on the daily gap", () => {
    const s = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      stageReps: 0,
      consecutiveCorrect: 0,
      ease: 2.3,
      lapses: 1,
    });
    const next = scheduleNext(
      s,
      review({ quality: "close", accuracy: 70, mode: "review" }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBe(REVIEW_DAILY_INTERVAL_DAYS);
    expect(next.stageReps).toBe(0);
    expect(next.ease).toBeCloseTo(2.3, 5);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
    expect(reviewingBar(next)).toBe(0);
  });

  it("moves a mastered verse at ease 2.3 back to about 90.9%", () => {
    let current = reviewing({
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      ease: 2.1,
      stageReps: 0,
      consecutiveCorrect: 0,
      status: "reviewing",
    });
    let previous = current;
    for (let guard = 0; guard < 40; guard += 1) {
      if (
        current.status === "mastered" &&
        Math.abs(current.ease - 2.3) < 1e-9
      ) {
        break;
      }
      previous = current;
      current = scheduleNext(
        current,
        review({
          quality: "exact",
          accuracy: 100,
          mode: "review",
          now: current.dueAt,
        }),
      );
    }
    expect(current.status).toBe("mastered");
    expect(current.ease).toBeCloseTo(2.3, 5);

    const next = scheduleNext(
      current,
      review({ quality: "close", accuracy: 72, mode: "review" }),
    );
    expect(next.status).toBe("reviewing");
    expect(next.intervalDays).toBeCloseTo(previous.intervalDays, 5);
    expect(next.ease).toBeCloseTo(previous.ease, 5);
    expect(next.stageReps).toBe(previous.stageReps);
    expect(next.lapses).toBe(0);
    expect(next.dueAt).toBe(dueAtInCalendarDays(NOW, next.intervalDays));
    expect(reviewingBar(next)).toBeCloseTo(10 / 11, 5);

    let past = current;
    for (let extra = 0; extra < 2; extra += 1) {
      past = scheduleNext(
        past,
        review({
          quality: "exact",
          accuracy: 100,
          mode: "review",
          now: past.dueAt,
        }),
      );
    }
    expect(past.status).toBe("mastered");
    expect(past.intervalDays).toBeGreaterThan(current.intervalDays);
    const fromPast = scheduleNext(
      past,
      review({ quality: "close", accuracy: 72, mode: "review" }),
    );
    expect(fromPast.status).toBe("reviewing");
    expect(fromPast.intervalDays).toBeCloseTo(previous.intervalDays, 5);
    expect(fromPast.ease).toBeCloseTo(previous.ease, 5);
    expect(reviewingBar(fromPast)).toBeCloseTo(10 / 11, 5);
  });
});

describe("ease clamping", () => {
  it("floors ease at EASE_MIN when a bad miss drops to Learning", () => {
    const s = reviewing({
      ease: EASE_MIN + 0.1,
      intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
      stageReps: 0,
    });
    const next = scheduleNext(
      s,
      review({ quality: "off", accuracy: 10, mode: "review" }),
    );
    expect(next.status).toBe("learning");
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

  it("still locks when lastReviewedAt lands after the 6-hour floor clock", () => {
    const locked = {
      ...learningAt(2),
      lastReviewedAt: NOW + 2_000,
      dueAt: NOW + MIN_LEARNING_LOCK_MS,
    };
    expect(isLearningLocked(locked, NOW)).toBe(true);
    expect(isDueForLearning(locked, NOW)).toBe(false);
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

describe("reviewingPathStartEase", () => {
  function exactAtDue(s: MemorySchedule): MemorySchedule {
    return scheduleNext(
      s,
      review({ quality: "exact", accuracy: 100, mode: "review", now: s.dueAt }),
    );
  }

  it("recovers the path's starting ease on every growth step", () => {
    for (const startEase of [1.3, EASE_START, 2.37, 2.8]) {
      let s = reviewing({
        intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
        ease: startEase,
        stageReps: 0,
        consecutiveCorrect: 0,
      });
      while (s.status === "reviewing") {
        if (s.intervalDays > REVIEW_EVERY_OTHER_INTERVAL_DAYS) {
          expect(reviewingPathStartEase(s.intervalDays, s.ease)).toBeCloseTo(
            startEase,
            10,
          );
        }
        s = exactAtDue(s);
      }
    }
  });

  it("recovers the starting ease after the verse is already mastered", () => {
    for (const startEase of [1.3, 2.1, EASE_START, 2.5, 2.8]) {
      let current = reviewing({
        intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
        ease: startEase,
        stageReps: 0,
        consecutiveCorrect: 0,
      });
      let masteredSteps = 0;
      while (masteredSteps < 3) {
        current = scheduleNext(
          current,
          review({
            quality: "exact",
            accuracy: 100,
            mode: "review",
            now: current.dueAt,
          }),
        );
        if (current.status === "mastered") {
          masteredSteps += 1;
          expect(
            reviewingPathStartEase(current.intervalDays, current.ease),
          ).toBeCloseTo(startEase, 8);
        }
      }
    }
  });

  it("returns the same value as the first call when called again", () => {
    const cases: Array<[number, number]> = [
      [REVIEW_DAILY_INTERVAL_DAYS, EASE_START],
      [REVIEW_EVERY_OTHER_INTERVAL_DAYS, EASE_START],
      [2.6, 2.6],
      [3, 1.85],
      [4.6, 2.35],
      [5.2, EASE_START],
      [7.3, 2.8],
      [29.9, 1.3],
      [0, EASE_START],
      [Number.NaN, EASE_START],
      [5.2, Number.NaN],
    ];
    const first = cases.map(([intervalDays, ease]) =>
      reviewingPathStartEase(intervalDays, ease),
    );
    const second = cases.map(([intervalDays, ease]) =>
      reviewingPathStartEase(intervalDays, ease),
    );
    expect(second.every((value, i) => Object.is(value, first[i]))).toBe(true);
    expect(first[0]).toBe(EASE_START);
    expect(first[2]).toBe(2.6);
    expect(first[5]).toBe(EASE_START);
  });

  it("returns the same start ease after more than 512 distinct inputs", () => {
    const keep = reviewingPathStartEase(5.2, EASE_START);
    const extras: Array<[number, number, number]> = [];
    for (let i = 0; i < REVIEWING_PATH_START_EASE_CACHE_LIMIT + 40; i += 1) {
      const intervalDays = 3 + i * 1e-6;
      const ease = 1.3 + i * 1e-6;
      extras.push([
        intervalDays,
        ease,
        reviewingPathStartEase(intervalDays, ease),
      ]);
    }

    expect(Object.is(reviewingPathStartEase(5.2, EASE_START), keep)).toBe(true);
    expect(
      extras.every(([intervalDays, ease, value]) =>
        Object.is(reviewingPathStartEase(intervalDays, ease), value),
      ),
    ).toBe(true);
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
