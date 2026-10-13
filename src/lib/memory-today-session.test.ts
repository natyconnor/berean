import { describe, expect, it } from "vitest";

import {
  planTodaySession,
  TODAY_QUEUE_REVIEW_LIMIT,
  todayInterstitialCopy,
  todayQueueGroups,
  todaySegmentMinutes,
  todaySessionCountLabel,
  todaySessionCounts,
  todaySessionDoneLine,
  todaySessionProgress,
  type TodayPassageInput,
  type TodayQueueEntry,
} from "./memory-today-session";

const PSALM_16: TodayPassageInput = {
  packId: "psalm16",
  packName: "Psalm 16",
  dueAt: 200,
};
const JOHN_15: TodayPassageInput = {
  packId: "john15",
  packName: "John 15",
  dueAt: 100,
};

describe("planTodaySession", () => {
  it("runs passages oldest first, then learning, then reviews", () => {
    expect(
      planTodaySession({
        passages: [PSALM_16, JOHN_15],
        learningVerses: 2,
        reviews: 5,
      }),
    ).toEqual([
      { kind: "passage", packId: "john15", title: "John 15" },
      { kind: "passage", packId: "psalm16", title: "Psalm 16" },
      { kind: "learning", verseCount: 2 },
      { kind: "review", reviewCount: 5 },
    ]);
  });

  it.each([
    {
      name: "no passages",
      input: { passages: [], learningVerses: 2, reviews: 5 },
      kinds: ["learning", "review"],
    },
    {
      name: "no learning",
      input: { passages: [PSALM_16], learningVerses: 0, reviews: 5 },
      kinds: ["passage", "review"],
    },
    {
      name: "no reviews",
      input: { passages: [PSALM_16], learningVerses: 2, reviews: 0 },
      kinds: ["passage", "learning"],
    },
    {
      name: "only passages",
      input: { passages: [PSALM_16], learningVerses: 0, reviews: 0 },
      kinds: ["passage"],
    },
    {
      name: "only learning",
      input: { passages: [], learningVerses: 3, reviews: 0 },
      kinds: ["learning"],
    },
    {
      name: "only reviews",
      input: { passages: [], learningVerses: 0, reviews: 1 },
      kinds: ["review"],
    },
    {
      name: "nothing at all",
      input: { passages: [], learningVerses: 0, reviews: 0 },
      kinds: [],
    },
  ])("skips empty segments: $name", ({ input, kinds }) => {
    expect(planTodaySession(input).map((segment) => segment.kind)).toEqual(
      kinds,
    );
  });

  it("lists a passage once even if the queue repeats it", () => {
    expect(
      planTodaySession({
        passages: [PSALM_16, { ...PSALM_16, dueAt: 300 }],
        learningVerses: 0,
        reviews: 0,
      }),
    ).toHaveLength(1);
  });

  it("keeps passages and new verses for only learning", () => {
    expect(
      planTodaySession({
        passages: [PSALM_16],
        learningVerses: 2,
        reviews: 5,
        only: "learning",
      }).map((segment) => segment.kind),
    ).toEqual(["passage", "learning"]);
  });

  it("keeps just the reviews for only reviews", () => {
    expect(
      planTodaySession({
        passages: [PSALM_16],
        learningVerses: 2,
        reviews: 5,
        only: "review",
      }),
    ).toEqual([{ kind: "review", reviewCount: 5 }]);
  });

  it("is empty when the chosen half has nothing to do", () => {
    expect(
      planTodaySession({
        passages: [],
        learningVerses: 0,
        reviews: 5,
        only: "learning",
      }),
    ).toEqual([]);
  });
});

describe("todayInterstitialCopy", () => {
  it("names what's next up, with the time on its own line", () => {
    expect(todayInterstitialCopy({ kind: "review", reviewCount: 4 })).toEqual({
      title: "Next up: 4 reviews",
      time: "About 4 min",
    });
    expect(todayInterstitialCopy({ kind: "review", reviewCount: 1 })).toEqual({
      title: "Next up: 1 review",
      time: "About 1 min",
    });
    expect(todayInterstitialCopy({ kind: "learning", verseCount: 3 })).toEqual({
      title: "Next up: 3 verses to learn",
      time: "About 9 min",
    });
    expect(todayInterstitialCopy({ kind: "learning", verseCount: 1 })).toEqual({
      title: "Next up: 1 verse to learn",
      time: "About 3 min",
    });
    expect(
      todayInterstitialCopy({
        kind: "passage",
        packId: "psalm1",
        title: "Psalm 1",
      }),
    ).toEqual({ title: "Next up: Psalm 1", time: "About 7 min" });
  });
});

describe("todaySessionProgress", () => {
  const segments = planTodaySession({
    passages: [PSALM_16],
    learningVerses: 2,
    reviews: 4,
  });

  it("weights each finished segment by its minutes", () => {
    expect(segments.map(todaySegmentMinutes)).toEqual([7, 6, 4]);
    expect(todaySessionProgress(segments, 0)).toBe(0);
    expect(todaySessionProgress(segments, 1)).toBeCloseTo(7 / 17);
    expect(todaySessionProgress(segments, 2)).toBeCloseTo(13 / 17);
    expect(todaySessionProgress(segments, 3)).toBe(1);
  });

  it("moves through the segment underway item by item", () => {
    expect(todaySessionProgress(segments, 1, 1)).toBeCloseTo(10 / 17);
    expect(todaySessionProgress(segments, 2, 1)).toBeCloseTo(14 / 17);
    expect(todaySessionProgress(segments, 2, 99)).toBeCloseTo(1);
  });

  it("clamps out-of-range counts and treats an empty plan as done", () => {
    expect(todaySessionProgress(segments, -1)).toBe(0);
    expect(todaySessionProgress(segments, 9)).toBe(1);
    expect(todaySessionProgress([], 0)).toBe(1);
  });
});

describe("todaySessionCounts", () => {
  const segments = planTodaySession({
    passages: [PSALM_16, JOHN_15],
    learningVerses: 3,
    reviews: 7,
  });

  it("counts a passage as one item and each verse and review as one", () => {
    expect(todaySessionCounts(segments, 0)).toEqual({ done: 0, total: 12 });
    expect(todaySessionCounts(segments, 2)).toEqual({ done: 2, total: 12 });
    expect(todaySessionCounts(segments, 2, 2)).toEqual({ done: 4, total: 12 });
    expect(todaySessionCounts(segments, 3, 9)).toEqual({ done: 12, total: 12 });
    expect(todaySessionCounts(segments, 4)).toEqual({ done: 12, total: 12 });
  });

  it("labels the bar as the whole day", () => {
    expect(todaySessionCountLabel({ done: 4, total: 12 })).toBe(
      "Today · 4 of 12",
    );
  });
});

describe("todayQueueGroups", () => {
  const segments = planTodaySession({
    passages: [PSALM_16, JOHN_15],
    learningVerses: 2,
    reviews: 2,
  });
  const learning: TodayQueueEntry[] = [
    { id: "jn1", label: "John 1:1" },
    { id: "jn2", label: "John 1:2" },
  ];
  const reviews: TodayQueueEntry[] = [
    { id: "lk9", label: "Luke 9:23" },
    { id: "rm8", label: "Romans 8:28" },
  ];

  function states(completed: number, current: number | null) {
    return todayQueueGroups({
      segments,
      learning,
      reviews,
      completed,
      current,
    }).map((group) => ({
      heading: group.heading,
      state: group.state,
      items: group.items.map((item) => `${item.label}:${item.state}`),
    }));
  }

  it("groups passages, new verses, and reviews in session order", () => {
    expect(states(0, 0)).toEqual([
      {
        heading: "Passages",
        state: "current",
        items: ["John 15:current", "Psalm 16:upcoming"],
      },
      {
        heading: "Verses to learn",
        state: "upcoming",
        items: ["John 1:1:upcoming", "John 1:2:upcoming"],
      },
      {
        heading: "Reviews",
        state: "upcoming",
        items: ["Luke 9:23:upcoming", "Romans 8:28:upcoming"],
      },
    ]);
  });

  it("marks what's done, underway, and still to come", () => {
    expect(states(2, 2)).toEqual([
      {
        heading: "Passages",
        state: "done",
        items: ["John 15:done", "Psalm 16:done"],
      },
      {
        heading: "Verses to learn",
        state: "current",
        items: ["John 1:1:current", "John 1:2:current"],
      },
      {
        heading: "Reviews",
        state: "upcoming",
        items: ["Luke 9:23:upcoming", "Romans 8:28:upcoming"],
      },
    ]);
  });

  it("has nothing underway between segments", () => {
    const [passages, ...rest] = states(1, null);
    expect(passages).toEqual({
      heading: "Passages",
      state: "current",
      items: ["John 15:done", "Psalm 16:upcoming"],
    });
    expect(rest.map((group) => group.state)).toEqual(["upcoming", "upcoming"]);
  });

  it("folds a long review list into +N more", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `r${index}`,
      label: `Review ${index}`,
    }));
    const [group] = todayQueueGroups({
      segments: [{ kind: "review", reviewCount: many.length }],
      learning: [],
      reviews: many,
      completed: 0,
      current: 0,
    });
    expect(group?.items).toHaveLength(TODAY_QUEUE_REVIEW_LIMIT);
    expect(group?.moreCount).toBe(20 - TODAY_QUEUE_REVIEW_LIMIT);
    expect(group?.total).toBe(20);
  });

  it("lists one past the limit instead of saying +1 more", () => {
    const reviewsJustOver = Array.from(
      { length: TODAY_QUEUE_REVIEW_LIMIT + 1 },
      (_, index) => ({ id: `r${index}`, label: `Review ${index}` }),
    );
    const [group] = todayQueueGroups({
      segments: [{ kind: "review", reviewCount: reviewsJustOver.length }],
      learning: [],
      reviews: reviewsJustOver,
      completed: 0,
      current: 0,
    });
    expect(group?.items).toHaveLength(TODAY_QUEUE_REVIEW_LIMIT + 1);
    expect(group?.moreCount).toBe(0);
  });
});

describe("todaySessionDoneLine", () => {
  it("lists what was done today", () => {
    expect(
      todaySessionDoneLine({
        passages: ["Psalm 16"],
        learningSteps: 2,
        reviews: 5,
      }),
    ).toBe("Psalm 16, 2 learning steps and 5 reviews done today.");
    expect(
      todaySessionDoneLine({ passages: [], learningSteps: 4, reviews: 0 }),
    ).toBe("4 learning steps done today.");
    expect(
      todaySessionDoneLine({ passages: [], learningSteps: 0, reviews: 1 }),
    ).toBe("1 review done today.");
  });

  it("still reads when nothing was counted", () => {
    expect(
      todaySessionDoneLine({ passages: [], learningSteps: 0, reviews: 0 }),
    ).toBe("Today's session is done.");
  });
});
