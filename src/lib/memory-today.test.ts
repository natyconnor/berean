import { describe, expect, it } from "vitest";

import type { GoalVerseInput } from "./memory-goals";
import { DAY_MS } from "./memory-scheduler";
import type { PassagePiece } from "./passage-pieces";
import {
  buildTodayModel,
  emptyTodayModel,
  formatNextReviewDay,
  todayDoneLine,
  todayHeadline,
  todaySessionMinutes,
  todayWorkCount,
  type TodayInput,
} from "./memory-today";

const HOUR_MS = 60 * 60 * 1000;
/** Friday, Oct 9, 2026, 15:00 UTC. */
const NOW = Date.UTC(2026, 9, 9, 15);
const DAY_START = Date.UTC(2026, 9, 9);
const TOMORROW = DAY_START + DAY_MS;

function verse(
  verseRefId: string,
  chapter: number,
  extra: Partial<GoalVerseInput> = {},
): GoalVerseInput {
  return {
    verseRefId,
    book: "Romans",
    chapter,
    startVerse: 1,
    endVerse: 1,
    status: "learning",
    learnStage: 0,
    intervalDays: 0,
    dueAt: NOW - HOUR_MS,
    createdAt: NOW - 3 * DAY_MS,
    ...extra,
  };
}

/** Today's step is done; the next session opens tomorrow. */
const lockedLearning = { dueAt: TOMORROW, lastReviewedAt: NOW - HOUR_MS };

function solidPiece(index: number): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 1,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment: "solid",
    learnStage: 3,
    stageReps: 0,
    dueAt: NOW - DAY_MS,
  };
}

function input(extra: Partial<TodayInput> = {}): TodayInput {
  return {
    now: NOW,
    tzOffsetMinutes: 0,
    verses: [],
    packs: [],
    passages: [],
    upNextByPackId: new Map(),
    upNextVerseRefIds: [],
    reviewTogether: new Map(),
    reviewTogetherVerseRefIds: new Set(),
    verseLogs: [],
    passageLogs: [],
    ...extra,
  };
}

describe("buildTodayModel: state", () => {
  it("is first run with nothing in Memory", () => {
    expect(buildTodayModel(input())).toEqual(emptyTodayModel());
  });

  it("is caught up when nothing is left today", () => {
    const model = buildTodayModel(
      input({
        verses: [
          verse("waiting", 1, lockedLearning),
          verse("later", 2, {
            status: "reviewing",
            intervalDays: 3,
            dueAt: NOW + 3 * DAY_MS,
          }),
        ],
      }),
    );

    expect(model.state).toBe("caughtUp");
    expect(model.counts).toEqual({
      learningVerses: 0,
      passageSessions: 0,
      reviews: 0,
    });
    expect(model.nextReviewAt).toBe(TOMORROW);
  });

  it("is caught up for a memorized passage that is not due", () => {
    const model = buildTodayModel(
      input({
        passages: [
          {
            packId: "psalm1",
            title: "Psalm 1",
            status: "reviewing",
            pieces: [solidPiece(0)],
            addsOnDay: 0,
            intervalDays: 4,
            dueAt: NOW + 2 * DAY_MS,
            createdAt: NOW - 20 * DAY_MS,
          },
        ],
      }),
    );

    expect(model.state).toBe("caughtUp");
    expect(model.totalInMemory).toBe(0);
    expect(model.nextReviewAt).toBe(NOW + 2 * DAY_MS);
  });

  it("has work when anything is left today", () => {
    const model = buildTodayModel(input({ verses: [verse("open", 1)] }));
    expect(model.state).toBe("work");
  });
});

describe("buildTodayModel: counts", () => {
  it("counts the learn queue, passage sessions, and reviews", () => {
    const model = buildTodayModel(
      input({
        verses: [
          verse("open", 1),
          verse("waiting", 2, lockedLearning),
          verse("upNext", 3, { status: "new" }),
          verse("due", 4, {
            status: "reviewing",
            intervalDays: 2,
            dueAt: NOW - HOUR_MS,
          }),
          verse("together", 5, {
            status: "reviewing",
            intervalDays: 2,
            dueAt: NOW - HOUR_MS,
          }),
          verse("mastered", 6, {
            status: "mastered",
            intervalDays: 40,
            dueAt: NOW + 10 * DAY_MS,
          }),
        ],
        packs: [
          {
            packId: "pack",
            name: "Pack",
            kind: "custom",
            verseRefIds: ["upNext", "together"],
            createdAt: NOW,
          },
        ],
        upNextByPackId: new Map([["pack", ["upNext"]]]),
        upNextVerseRefIds: ["upNext"],
        reviewTogether: new Map([["pack", NOW - HOUR_MS]]),
        reviewTogetherVerseRefIds: new Set(["together"]),
        passages: [
          {
            packId: "psalm16",
            title: "Psalm 16",
            status: "building",
            pieces: [{ ...solidPiece(0), attachment: "unreached" }],
            addsOnDay: 0,
            intervalDays: 0,
            dueAt: NOW,
            createdAt: NOW,
          },
          {
            packId: "psalm1",
            title: "Psalm 1",
            status: "reviewing",
            pieces: [solidPiece(0)],
            addsOnDay: 0,
            intervalDays: 4,
            dueAt: NOW - HOUR_MS,
            createdAt: NOW - 20 * DAY_MS,
          },
        ],
      }),
    );

    expect(model.state).toBe("work");
    expect(model.counts).toEqual({
      // "open" plus the Up-next verse.
      learningVerses: 2,
      passageSessions: 1,
      // "due", the pack recited together, and Psalm 1.
      reviews: 3,
    });
    expect(model.statusCounts).toEqual({
      learning: 3,
      memorized: 2,
      mastered: 1,
    });
    expect(model.totalInMemory).toBe(6);
    expect(model.hasAnythingMemorized).toBe(true);
    expect(model.nextReviewAt).toBe(TOMORROW);
    expect(model.goals.map((goal) => goal.title)).toContain("Psalm 16");
  });

  it("has nothing memorized while every verse is still learning", () => {
    const model = buildTodayModel(input({ verses: [verse("open", 1)] }));
    expect(model.hasAnythingMemorized).toBe(false);
  });
});

describe("buildTodayModel: done today", () => {
  it("counts distinct learning steps and reviews since local midnight", () => {
    const model = buildTodayModel(
      input({
        verses: [verse("waiting", 1, lockedLearning)],
        verseLogs: [
          { verseRefId: "a", mode: "learn", createdAt: NOW - 2 * HOUR_MS },
          { verseRefId: "a", mode: "learn", createdAt: NOW - HOUR_MS },
          { verseRefId: "b", mode: "learn", createdAt: NOW - HOUR_MS },
          { verseRefId: "c", mode: "review", createdAt: NOW - HOUR_MS },
          { verseRefId: "d", mode: "practice", createdAt: NOW - HOUR_MS },
          { verseRefId: "e", mode: "review", createdAt: DAY_START - 1 },
        ],
        passageLogs: [
          {
            passageMemoryId: "p",
            kind: "frontier",
            pieceIndex: 4,
            createdAt: NOW - HOUR_MS,
          },
          {
            passageMemoryId: "p",
            kind: "frontier",
            pieceIndex: 4,
            createdAt: NOW - HOUR_MS / 2,
          },
          { passageMemoryId: "p", kind: "rope", createdAt: NOW - HOUR_MS },
          { passageMemoryId: "q", kind: "review", createdAt: NOW - HOUR_MS },
        ],
      }),
    );

    expect(model.doneToday).toEqual({ learningSteps: 3, reviews: 2 });
    expect(model.startedToday).toBe(true);
  });

  it("is not started by extra practice or yesterday's work", () => {
    const model = buildTodayModel(
      input({
        verses: [verse("open", 1)],
        verseLogs: [
          { verseRefId: "a", mode: "practice", createdAt: NOW - HOUR_MS },
          { verseRefId: "b", mode: "learn", createdAt: DAY_START - 1 },
        ],
      }),
    );

    expect(model.doneToday).toEqual({ learningSteps: 0, reviews: 0 });
    expect(model.startedToday).toBe(false);
  });

  it("uses the viewer's local midnight", () => {
    // UTC-7: local midnight is 07:00 UTC, so 06:00 UTC was yesterday.
    const model = buildTodayModel(
      input({
        tzOffsetMinutes: 420,
        verses: [verse("open", 1)],
        verseLogs: [
          {
            verseRefId: "a",
            mode: "review",
            createdAt: DAY_START + 6 * HOUR_MS,
          },
          {
            verseRefId: "b",
            mode: "review",
            createdAt: DAY_START + 8 * HOUR_MS,
          },
        ],
      }),
    );

    expect(model.doneToday.reviews).toBe(1);
  });
});

describe("todayHeadline", () => {
  it("joins learning and reviews, leaving out a zero part", () => {
    expect(
      todayHeadline({ learningVerses: 2, passageSessions: 1, reviews: 5 }),
    ).toBe("3 to learn · 5 to review");
    expect(
      todayHeadline({ learningVerses: 0, passageSessions: 0, reviews: 5 }),
    ).toBe("5 to review");
    expect(
      todayHeadline({ learningVerses: 3, passageSessions: 0, reviews: 0 }),
    ).toBe("3 to learn");
    expect(
      todayHeadline({ learningVerses: 0, passageSessions: 0, reviews: 0 }),
    ).toBeNull();
  });
});

describe("todayDoneLine", () => {
  it("says what was done today, leaving out a zero part", () => {
    expect(todayDoneLine({ learningSteps: 4, reviews: 5 })).toBe(
      "4 learning steps and 5 reviews done today.",
    );
    expect(todayDoneLine({ learningSteps: 1, reviews: 0 })).toBe(
      "1 learning step done today.",
    );
    expect(todayDoneLine({ learningSteps: 0, reviews: 1 })).toBe(
      "1 review done today.",
    );
    expect(todayDoneLine({ learningSteps: 0, reviews: 0 })).toBeNull();
  });
});

describe("todayWorkCount / todaySessionMinutes", () => {
  it("adds up what is left and estimates its minutes", () => {
    const counts = { learningVerses: 4, passageSessions: 0, reviews: 5 };
    expect(todayWorkCount(counts)).toBe(9);
    expect(todaySessionMinutes(counts)).toBe(17);
    expect(
      todaySessionMinutes({
        learningVerses: 0,
        passageSessions: 0,
        reviews: 0,
      }),
    ).toBe(0);
  });
});

describe("formatNextReviewDay", () => {
  it("names tomorrow, a weekday this week, or a date", () => {
    expect(formatNextReviewDay(NOW + DAY_MS, NOW, "UTC")).toBe("tomorrow");
    expect(formatNextReviewDay(NOW + 2 * DAY_MS, NOW, "UTC")).toBe("Sunday");
    expect(formatNextReviewDay(NOW + 4 * HOUR_MS, NOW, "UTC")).toBe(
      "later today",
    );
    expect(formatNextReviewDay(NOW + 11 * DAY_MS, NOW, "UTC")).toBe("Oct 20");
    expect(formatNextReviewDay(null, NOW, "UTC")).toBeNull();
  });

  it("counts calendar days in the viewer's zone", () => {
    // 23:00 in Los Angeles; 08:00 UTC next day is 01:00 local, tomorrow.
    const lateEvening = Date.UTC(2026, 9, 10, 6);
    expect(
      formatNextReviewDay(
        Date.UTC(2026, 9, 10, 8),
        lateEvening,
        "America/Los_Angeles",
      ),
    ).toBe("tomorrow");
  });
});
