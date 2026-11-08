import { describe, expect, it } from "vitest";

import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
  offersSummaryRefresh,
  recalledCopy,
  refresherResultCopy,
  type ReviewSessionAttempt,
} from "./review-session-attempts";

const john: ReviewSessionAttempt = {
  reference: { book: "John", chapter: 3, startVerse: 16, endVerse: 16 },
  accuracy: 85,
};

describe("averageReviewAccuracy", () => {
  it("returns null when nothing was graded", () => {
    expect(averageReviewAccuracy([])).toBeNull();
  });

  it("averages every recitation, including retries", () => {
    expect(averageReviewAccuracy([john, { ...john, accuracy: 100 }])).toBe(93);
  });
});

describe("groupReviewSessionAttempts", () => {
  it("keeps each recitation on one verse row", () => {
    const grouped = groupReviewSessionAttempts([
      john,
      { ...john, accuracy: 100 },
      {
        reference: { book: "John", chapter: 1, startVerse: 1, endVerse: 1 },
        accuracy: 90,
      },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.accuracies).toEqual([85, 100]);
    expect(grouped[1]?.accuracies).toEqual([90]);
  });

  it("keeps a later refresher and landed schedule on the same row", () => {
    const schedule = {
      status: "reviewing" as const,
      learnStage: 3,
      stageReps: 2,
      intervalDays: 5,
      ease: 2.3,
      dueAt: 1_700_000_000_000,
    };
    const grouped = groupReviewSessionAttempts([
      { ...john, accuracy: 78 },
      {
        ...john,
        accuracy: 100,
        refresherUsed: true,
        schedule,
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.accuracies).toEqual([78, 100]);
    expect(grouped[0]?.refresherUsed).toBe(true);
    expect(grouped[0]?.schedule).toEqual(schedule);
  });
});

describe("recalledCopy", () => {
  it("names a retry as a second score", () => {
    expect(recalledCopy([85, 100])).toBe("85%, then 100% recalled");
  });
});

describe("refresherResultCopy", () => {
  it("names the first and last scores when a refresher was used", () => {
    expect(refresherResultCopy([78, 100])).toBe("78% → 100% · Refresher used");
  });
});

describe("offersSummaryRefresh (S9, R21)", () => {
  function landed(
    status: "new" | "learning" | "reviewing" | "mastered",
  ): ReviewSessionAttempt["schedule"] {
    return {
      status,
      learnStage: 3,
      stageReps: 0,
      intervalDays: 4,
      ease: 2.3,
      dueAt: 1,
    };
  }

  function offers(attempts: ReviewSessionAttempt[]): boolean[] {
    return groupReviewSessionAttempts(attempts).map(offersSummaryRefresh);
  }

  it.each([84, 60, 59, 0])(
    "offers it on a %i%% last try that stays Memorized or Mastered",
    (accuracy) => {
      expect(
        offers([
          { ...john, accuracy, schedule: landed("reviewing") },
          {
            ...john,
            reference: { ...john.reference, startVerse: 17, endVerse: 17 },
            accuracy,
            schedule: landed("mastered"),
          },
        ]),
      ).toEqual([true, true]);
    },
  );

  it.each([85, 100])("hides it on a %i%% last try", (accuracy) => {
    expect(
      offers([{ ...john, accuracy, schedule: landed("reviewing") }]),
    ).toEqual([false]);
  });

  it("goes by the last try, not the lowest: 78% → 100% has none", () => {
    expect(
      offers([
        { ...john, accuracy: 78, offerPractice: true },
        {
          ...john,
          accuracy: 100,
          refresherUsed: true,
          schedule: landed("reviewing"),
        },
      ]),
    ).toEqual([false]);
    expect(
      offers([
        { ...john, accuracy: 68, offerPractice: true },
        {
          ...john,
          accuracy: 70,
          refresherUsed: true,
          schedule: landed("reviewing"),
        },
      ]),
    ).toEqual([true]);
  });

  it("uses the saved status of an applied held miss", () => {
    expect(
      offers([{ ...john, accuracy: 84, savedStatus: "reviewing" }]),
    ).toEqual([true]);
    expect(
      offers([{ ...john, accuracy: 40, savedStatus: "learning" }]),
    ).toEqual([false]);
  });

  it("hides it for Learning (including a lapse), New and unknown status", () => {
    expect(
      offers([{ ...john, accuracy: 40, schedule: landed("learning") }]),
    ).toEqual([false]);
    expect(
      offers([{ ...john, accuracy: 40, schedule: landed("new") }]),
    ).toEqual([false]);
    expect(offers([{ ...john, accuracy: 40 }])).toEqual([false]);
  });

  it("hides it on a pack recited as one passage and its member rows", () => {
    expect(
      offers([
        {
          ...john,
          accuracy: 50,
          label: "Hope pack",
          offerPractice: false,
          schedule: landed("reviewing"),
        },
        {
          ...john,
          reference: { ...john.reference, startVerse: 18, endVerse: 18 },
          accuracy: 50,
          offerPractice: false,
          schedule: landed("reviewing"),
        },
      ]),
    ).toEqual([false, false]);
  });
});
