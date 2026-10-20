import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  initialSchedule,
  MASTERED_INTERVAL_DAYS,
  scheduleNext,
  type MemorySchedule,
} from "./memory-scheduler";
import {
  estimateMasteryDays,
  estimateMemorizeDays,
  estimateReviewDaysToMastery,
  estimateSessionMinutes,
  formatDueDay,
  formatLearnDuration,
  formatMasteryDuration,
  formatMonthOrDate,
  formatShortDate,
  nextStepCopy,
  projectedFinishDate,
  projectedMasteryDate,
} from "./memorize-plan";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Direct scheduler loop, written independently of memorize-plan: one verse,
 * every grade exact, each attempt on the day the scheduler allows it.
 */
function simulateWithScheduler(): { learnDays: number; reviewDays: number } {
  let now = 0;
  let schedule: MemorySchedule = initialSchedule(now);
  let learnDays = 1;
  let guard = 0;
  while (schedule.status === "new" || schedule.status === "learning") {
    schedule = scheduleNext(schedule, {
      quality: "exact",
      accuracy: 100,
      mode: "learn",
      now,
    });
    if (schedule.status === "learning" && schedule.dueAt > now) {
      now = schedule.dueAt;
      learnDays += 1;
    }
    guard += 1;
    if (guard > 1000) throw new Error("learning ladder never graduated");
  }

  const graduatedAt = now;
  while (schedule.status !== "mastered") {
    now = schedule.dueAt;
    schedule = scheduleNext(schedule, {
      quality: "exact",
      accuracy: 100,
      mode: "review",
      now,
    });
    guard += 1;
    if (guard > 1000) throw new Error("reviews never reached mastered");
  }
  return { learnDays, reviewDays: (now - graduatedAt) / DAY_MS };
}

describe("estimateMemorizeDays", () => {
  it("takes three days for one verse", () => {
    expect(estimateMemorizeDays({ mode: "verse", verseCount: 1 })).toBe(3);
    expect(estimateMemorizeDays({ mode: "verse", verseCount: 3 })).toBe(3);
  });

  it("adds five passage verses a day, then finishes the last one", () => {
    expect(estimateMemorizeDays({ mode: "passage", verseCount: 6 })).toBe(4);
    expect(estimateMemorizeDays({ mode: "passage", verseCount: 11 })).toBe(5);
    expect(estimateMemorizeDays({ mode: "passage", verseCount: 31 })).toBe(9);
  });

  it("learns a pack three verses at a time", () => {
    expect(estimateMemorizeDays({ mode: "pack", verseCount: 1 })).toBe(3);
    expect(estimateMemorizeDays({ mode: "pack", verseCount: 3 })).toBe(3);
    expect(estimateMemorizeDays({ mode: "pack", verseCount: 4 })).toBe(6);
    expect(estimateMemorizeDays({ mode: "pack", verseCount: 9 })).toBe(9);
  });

  it("is 0 for an empty target", () => {
    expect(estimateMemorizeDays({ mode: "passage", verseCount: 0 })).toBe(0);
    expect(estimateMemorizeDays({ mode: "pack", verseCount: -2 })).toBe(0);
  });
});

describe("formatLearnDuration", () => {
  it("says about a day for one day or less", () => {
    expect(formatLearnDuration(1)).toBe("Learn it in about a day");
    expect(formatLearnDuration(0)).toBe("Learn it in about a day");
  });

  it("counts days from 2 to 6", () => {
    expect(formatLearnDuration(2)).toBe("Learn it in about 2 days");
    expect(formatLearnDuration(6)).toBe("Learn it in about 6 days");
  });

  it("rounds 7 to 10 days to about a week", () => {
    expect(formatLearnDuration(7)).toBe("Learn it in about a week");
    expect(formatLearnDuration(10)).toBe("Learn it in about a week");
  });

  it("counts weeks from 11 days", () => {
    expect(formatLearnDuration(11)).toBe("Learn it in about 2 weeks");
    expect(formatLearnDuration(24)).toBe("Learn it in about 3 weeks");
  });

  it("drops the lead in the short form", () => {
    expect(formatLearnDuration(4, { short: true })).toBe("about 4 days");
    expect(formatLearnDuration(1, { short: true })).toBe("about a day");
  });
});

describe("formatMasteryDuration", () => {
  it("counts weeks under 8 weeks", () => {
    expect(formatMasteryDuration(5)).toBe("Mastered in about a week");
    expect(formatMasteryDuration(20)).toBe("Mastered in about 3 weeks");
    expect(formatMasteryDuration(55)).toBe("Mastered in about 8 weeks");
  });

  it("counts months from 8 weeks, at least 2", () => {
    expect(formatMasteryDuration(56)).toBe("Mastered in about 2 months");
    expect(formatMasteryDuration(120)).toBe("Mastered in about 4 months");
  });

  it("drops the lead when short", () => {
    expect(formatMasteryDuration(120, { short: true })).toBe("about 4 months");
    expect(formatMasteryDuration(5, { short: true })).toBe("about a week");
  });
});

describe("mastery estimates", () => {
  const direct = simulateWithScheduler();

  it("matches a direct scheduler loop for review days", () => {
    expect(estimateReviewDaysToMastery()).toBe(direct.reviewDays);
    expect(direct.reviewDays).toBeGreaterThan(MASTERED_INTERVAL_DAYS);
  });

  it("matches the scheduler's learning ladder for one verse", () => {
    expect(estimateMemorizeDays({ mode: "verse", verseCount: 1 })).toBe(
      direct.learnDays,
    );
  });

  it("adds review days to learning days", () => {
    expect(estimateMasteryDays({ mode: "verse", verseCount: 1 })).toBe(
      direct.learnDays + direct.reviewDays,
    );
    expect(estimateMasteryDays({ mode: "passage", verseCount: 11 })).toBe(
      estimateMemorizeDays({ mode: "passage", verseCount: 11 }) +
        direct.reviewDays,
    );
    expect(estimateMasteryDays({ mode: "pack", verseCount: 0 })).toBe(0);
  });

  it("reads as about 2 months for one verse today", () => {
    expect(
      formatMasteryDuration(
        estimateMasteryDays({ mode: "verse", verseCount: 1 }),
      ),
    ).toBe("Mastered in about 2 months");
  });
});

describe("estimateSessionMinutes", () => {
  it("is 0 when there is nothing to do", () => {
    expect(
      estimateSessionMinutes({
        learningVerses: 0,
        reviewVerses: 0,
        passageSessions: 0,
      }),
    ).toBe(0);
  });

  it("rounds to whole minutes, at least 1", () => {
    expect(
      estimateSessionMinutes({
        learningVerses: 0,
        reviewVerses: 1,
        passageSessions: 0,
      }),
    ).toBe(1);
    expect(
      estimateSessionMinutes({
        learningVerses: 0,
        reviewVerses: 3,
        passageSessions: 0,
      }),
    ).toBe(3);
    expect(
      estimateSessionMinutes({
        learningVerses: 2,
        reviewVerses: 3,
        passageSessions: 1,
      }),
    ).toBe(16);
  });
});

describe("nextStepCopy", () => {
  // Monday, October 12, 2026, 3pm UTC.
  const NOW = Date.UTC(2026, 9, 12, 15);
  const LOCKED_DUE = NOW + 10 * HOUR_MS;

  it("names today's step while the session is open", () => {
    expect(
      nextStepCopy({ status: "learning", learnStage: 0, dueAt: NOW }, NOW),
    ).toBe("Read it, then type it with first letters");
    expect(
      nextStepCopy({ status: "learning", learnStage: 1, dueAt: NOW }, NOW),
    ).toBe("Read it, then type it with first letters");
    expect(
      nextStepCopy({ status: "learning", learnStage: 2, dueAt: NOW }, NOW),
    ).toBe("Fill in the blanks");
    expect(
      nextStepCopy({ status: "learning", learnStage: 3, dueAt: NOW }, NOW),
    ).toBe("Say it from memory");
  });

  it("looks ahead to blanks after Read or First letters", () => {
    for (const learnStage of [0, 1, 2]) {
      expect(
        nextStepCopy(
          { status: "learning", learnStage, dueAt: LOCKED_DUE },
          NOW,
        ),
      ).toBe("Nice. Later today you'll try it with blanks.");
    }
  });

  it("looks ahead to From memory after blanks", () => {
    expect(
      nextStepCopy(
        { status: "learning", learnStage: 3, dueAt: LOCKED_DUE },
        NOW,
      ),
    ).toBe("Great. Later today you'll say it from memory.");
  });

  it("looks ahead to tomorrow when the lock is the next local day", () => {
    expect(
      nextStepCopy(
        {
          status: "learning",
          learnStage: 1,
          dueAt: Date.UTC(2026, 9, 13),
        },
        NOW,
        "UTC",
      ),
    ).toBe("Nice. Tomorrow you'll try it with blanks.");
  });

  it("keeps an in-progress verse open against a stale clock", () => {
    expect(
      nextStepCopy(
        {
          status: "learning",
          learnStage: 2,
          dueAt: NOW + 2 * HOUR_MS,
          lastReviewedAt: NOW + 2 * HOUR_MS,
        },
        NOW,
      ),
    ).toBe("Fill in the blanks");
  });

  it("says an up-next verse starts when you're ready", () => {
    expect(
      nextStepCopy({ status: "new", learnStage: 0, dueAt: NOW }, NOW),
    ).toBe("Up next. Starts when you're ready.");
  });

  it("brings a just-memorized verse back tomorrow", () => {
    expect(
      nextStepCopy(
        { status: "reviewing", learnStage: 3, dueAt: Date.UTC(2026, 9, 13) },
        NOW,
        "UTC",
      ),
    ).toBe("Memorized. We'll bring it back tomorrow to keep it fresh.");
    expect(
      nextStepCopy(
        { status: "mastered", learnStage: 3, dueAt: Date.UTC(2026, 9, 13) },
        NOW,
        "UTC",
      ),
    ).toBe("Next review tomorrow");
  });

  it("names the weekday of a later review this week", () => {
    expect(
      nextStepCopy(
        { status: "reviewing", learnStage: 3, dueAt: Date.UTC(2026, 9, 15) },
        NOW,
        "UTC",
      ),
    ).toBe("Next review Thu");
  });

  it("names the date of a review a week or more out", () => {
    expect(
      nextStepCopy(
        { status: "mastered", learnStage: 3, dueAt: Date.UTC(2026, 9, 30) },
        NOW,
        "UTC",
      ),
    ).toBe("Next review Oct 30");
  });

  it("says a due review is due today", () => {
    expect(
      nextStepCopy(
        { status: "reviewing", learnStage: 3, dueAt: NOW - HOUR_MS },
        NOW,
        "UTC",
      ),
    ).toBe("Review due today");
  });

  it("counts calendar days in the viewer's time zone", () => {
    // 7pm Oct 12 in Los Angeles; due at local midnight.
    const evening = Date.UTC(2026, 9, 13, 2);
    const localMidnight = Date.UTC(2026, 9, 13, 7);
    const schedule = {
      status: "reviewing" as const,
      learnStage: 3,
      dueAt: localMidnight,
    };
    expect(nextStepCopy(schedule, evening, "America/Los_Angeles")).toBe(
      "Memorized. We'll bring it back tomorrow to keep it fresh.",
    );
    expect(nextStepCopy(schedule, evening, "UTC")).toBe("Review due today");
  });
});

describe("formatDueDay", () => {
  // Monday, October 12, 2026, 3pm UTC.
  const NOW = Date.UTC(2026, 9, 12, 15);

  it("says today for anything due now or earlier", () => {
    expect(formatDueDay(NOW - HOUR_MS, NOW, "UTC")).toBe("today");
    expect(formatDueDay(NOW + HOUR_MS, NOW, "UTC")).toBe("today");
  });

  it("says tomorrow, then a weekday, then a date", () => {
    expect(formatDueDay(Date.UTC(2026, 9, 13, 9), NOW, "UTC")).toBe("tomorrow");
    expect(formatDueDay(Date.UTC(2026, 9, 15), NOW, "UTC")).toBe("Thu");
    expect(formatDueDay(Date.UTC(2026, 9, 30), NOW, "UTC")).toBe("Oct 30");
  });
});

describe("projected dates", () => {
  // October 30, 2026, noon local time.
  const NOW = new Date(2026, 9, 30, 12).getTime();

  function calendarDay(date: Date): [number, number, number] {
    return [date.getFullYear(), date.getMonth(), date.getDate()];
  }

  it("finishes learning across a month boundary", () => {
    expect(
      calendarDay(
        projectedFinishDate(
          { mode: "passage", verseCount: 11, learnedCount: 0 },
          NOW,
        ),
      ),
    ).toEqual([2026, 10, 3]);
    expect(
      calendarDay(
        projectedFinishDate(
          { mode: "pack", verseCount: 4, learnedCount: 0 },
          NOW,
        ),
      ),
    ).toEqual([2026, 10, 4]);
  });

  it("only counts verses still to learn", () => {
    expect(
      calendarDay(
        projectedFinishDate(
          { mode: "passage", verseCount: 11, learnedCount: 6 },
          NOW,
        ),
      ),
    ).toEqual([2026, 10, 1]);
    expect(
      calendarDay(
        projectedFinishDate(
          { mode: "verse", verseCount: 1, learnedCount: 1 },
          NOW,
        ),
      ),
    ).toEqual([2026, 9, 30]);
  });

  it("projects mastery from the same scheduler estimate", () => {
    const start = new Date(2026, 9, 30, 12);
    const expected = new Date(start);
    expected.setDate(
      expected.getDate() +
        estimateMasteryDays({ mode: "verse", verseCount: 1 }) -
        1,
    );
    expect(
      calendarDay(
        projectedMasteryDate(
          { mode: "verse", verseCount: 1, learnedCount: 0 },
          start.getTime(),
        ),
      ),
    ).toEqual(calendarDay(expected));

    const learned = new Date(start);
    learned.setDate(learned.getDate() + estimateReviewDaysToMastery());
    expect(
      calendarDay(
        projectedMasteryDate(
          { mode: "verse", verseCount: 1, learnedCount: 1 },
          start.getTime(),
        ),
      ),
    ).toEqual(calendarDay(learned));
  });
});

describe("date formatting", () => {
  const NOW = Date.UTC(2026, 9, 12, 15);

  it("formats a short month and day", () => {
    expect(formatShortDate(new Date(Date.UTC(2026, 9, 20, 12)), "UTC")).toBe(
      "Oct 20",
    );
  });

  it("uses the date within 6 weeks and the month after", () => {
    expect(
      formatMonthOrDate(new Date(Date.UTC(2026, 9, 20, 12)), NOW, "UTC"),
    ).toBe("Oct 20");
    expect(
      formatMonthOrDate(new Date(Date.UTC(2026, 11, 10, 12)), NOW, "UTC"),
    ).toBe("around December");
  });
});
