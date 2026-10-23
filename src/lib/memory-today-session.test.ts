import { describe, expect, it } from "vitest";

import {
  carryTodayProgress,
  planTodaySession,
  TODAY_QUEUE_REVIEW_LIMIT,
  todayDoneItems,
  todayFinishedSegments,
  todayInterstitialCopy,
  todayNextSegment,
  todayQueueGroups,
  todayQueueItemStep,
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
    expect(todaySessionProgress(segments, [0, 0, 0])).toBe(0);
    expect(todaySessionProgress(segments, [1, 0, 0])).toBeCloseTo(7 / 17);
    expect(todaySessionProgress(segments, [1, 2, 0])).toBeCloseTo(13 / 17);
    expect(todaySessionProgress(segments, [1, 2, 4])).toBe(1);
  });

  it("counts segments taken out of order", () => {
    expect(todaySessionProgress(segments, [0, 0, 4])).toBeCloseTo(4 / 17);
    expect(todaySessionProgress(segments, [0, 1, 2])).toBeCloseTo(5 / 17);
  });

  it("moves through a segment item by item", () => {
    expect(todaySessionProgress(segments, [1, 1, 0])).toBeCloseTo(10 / 17);
    expect(todaySessionProgress(segments, [1, 2, 1])).toBeCloseTo(14 / 17);
  });

  it("clamps out-of-range counts and treats an empty plan as done", () => {
    expect(todaySessionProgress(segments, [-1, 0, 0])).toBe(0);
    expect(todaySessionProgress(segments, [9, 99, 99])).toBe(1);
    expect(todaySessionProgress(segments, [])).toBe(0);
    expect(todaySessionProgress([], [])).toBe(1);
  });
});

describe("todaySessionCounts", () => {
  const segments = planTodaySession({
    passages: [PSALM_16, JOHN_15],
    learningVerses: 3,
    reviews: 7,
  });

  it("counts a passage as one item and each verse and review as one", () => {
    expect(todaySessionCounts(segments, [])).toEqual({ done: 0, total: 12 });
    expect(todaySessionCounts(segments, [1, 1])).toEqual({
      done: 2,
      total: 12,
    });
    expect(todaySessionCounts(segments, [1, 1, 2])).toEqual({
      done: 4,
      total: 12,
    });
    expect(todaySessionCounts(segments, [0, 1, 0, 3])).toEqual({
      done: 4,
      total: 12,
    });
    expect(todaySessionCounts(segments, [9, 9, 9, 9])).toEqual({
      done: 12,
      total: 12,
    });
  });

  it("labels the bar as the whole day", () => {
    expect(todaySessionCountLabel({ done: 4, total: 12 })).toBe(
      "Today · 4 of 12",
    );
  });
});

const QUEUE_SEGMENTS = planTodaySession({
  passages: [PSALM_16, JOHN_15],
  learningVerses: 2,
  reviews: 2,
});
const QUEUE_LEARNING: TodayQueueEntry[] = [
  { id: "jn1", label: "John 1:1" },
  { id: "jn2", label: "John 1:2" },
];
const QUEUE_REVIEWS: TodayQueueEntry[] = [
  { id: "lk9", label: "Luke 9:23" },
  { id: "rm8", label: "Romans 8:28" },
];

function progressInput(done: number[], spent: string[] = []) {
  return {
    segments: QUEUE_SEGMENTS,
    learning: QUEUE_LEARNING,
    reviews: QUEUE_REVIEWS,
    done: new Set(done),
    spent: new Set(spent),
  };
}

describe("todayDoneItems", () => {
  it("counts finished segments in full and spent cards one by one", () => {
    expect(todayDoneItems(progressInput([]))).toEqual([0, 0, 0, 0]);
    expect(todayDoneItems(progressInput([1, 2]))).toEqual([0, 1, 2, 0]);
    expect(todayDoneItems(progressInput([0], ["jn2", "lk9"]))).toEqual([
      1, 0, 1, 1,
    ]);
  });
});

describe("todayFinishedSegments", () => {
  it("adds a verse segment whose every card is spent", () => {
    expect([
      ...todayFinishedSegments(progressInput([0], ["jn1", "jn2", "lk9"])),
    ]).toEqual([0, 2]);
  });
});

describe("todayNextSegment", () => {
  it("goes to the next unfinished segment, wrapping back to skipped ones", () => {
    expect(todayNextSegment(4, new Set([0]), 0)).toBe(1);
    expect(todayNextSegment(4, new Set([1, 2]), 1)).toBe(3);
    expect(todayNextSegment(4, new Set([2, 3]), 3)).toBe(0);
    expect(todayNextSegment(4, new Set([0, 1, 2, 3]), 3)).toBeNull();
    expect(todayNextSegment(1, new Set([0]), 0)).toBeNull();
  });
});

describe("todayQueueGroups", () => {
  function states(
    done: number[],
    current: number | null,
    {
      spent = [],
      reopenable = [],
    }: { spent?: string[]; reopenable?: string[] } = {},
  ) {
    return todayQueueGroups({
      ...progressInput(done, spent),
      reopenable: new Set(reopenable),
      current,
    }).map((group) => ({
      heading: group.heading,
      state: group.state,
      target: group.target,
      items: group.items.map(
        (item) =>
          `${item.label}:${item.state}${item.openable ? ":open" : ""}@${item.segment}`,
      ),
    }));
  }

  it("groups passages, new verses, and reviews in session order", () => {
    expect(states([], 0)).toEqual([
      {
        heading: "Passages",
        state: "current",
        target: null,
        items: ["John 15:current@0", "Psalm 16:upcoming:open@1"],
      },
      {
        heading: "Verses to learn",
        state: "upcoming",
        target: 2,
        items: ["John 1:1:upcoming:open@2", "John 1:2:upcoming:open@2"],
      },
      {
        heading: "Reviews",
        state: "upcoming",
        target: 3,
        items: ["Luke 9:23:upcoming:open@3", "Romans 8:28:upcoming:open@3"],
      },
    ]);
  });

  it("marks what's done, underway, and still to come", () => {
    expect(states([0, 1], 2)).toEqual([
      {
        heading: "Passages",
        state: "done",
        target: null,
        items: ["John 15:done@0", "Psalm 16:done@1"],
      },
      {
        heading: "Verses to learn",
        state: "current",
        target: null,
        items: ["John 1:1:current@2", "John 1:2:current@2"],
      },
      {
        heading: "Reviews",
        state: "upcoming",
        target: 3,
        items: ["Luke 9:23:upcoming:open@3", "Romans 8:28:upcoming:open@3"],
      },
    ]);
  });

  it("has nothing underway between segments", () => {
    const [passages, ...rest] = states([0], null);
    expect(passages).toEqual({
      heading: "Passages",
      state: "upcoming",
      target: 1,
      items: ["John 15:done@0", "Psalm 16:upcoming:open@1"],
    });
    expect(rest.map((group) => group.state)).toEqual(["upcoming", "upcoming"]);
  });

  it("follows the segment taken out of order, leaving skipped ones open", () => {
    const groups = states([], 3, { spent: ["lk9"] });
    expect(groups.map((group) => group.state)).toEqual([
      "upcoming",
      "upcoming",
      "current",
    ]);
    expect(groups[0]?.target).toBe(0);
    expect(groups[2]?.items).toEqual([
      "Luke 9:23:done@3",
      "Romans 8:28:current@3",
    ]);
  });

  it("marks a verse segment's spent cards done and keeps the rest open", () => {
    const [, learning] = states([0], 1, { spent: ["jn1"] });
    expect(learning).toEqual({
      heading: "Verses to learn",
      state: "upcoming",
      target: 2,
      items: ["John 1:1:done@2", "John 1:2:upcoming:open@2"],
    });
    const [, allSpent] = states([0], 1, { spent: ["jn1", "jn2"] });
    expect(allSpent?.state).toBe("done");
    expect(allSpent?.target).toBeNull();
  });

  it("reopens a finished passage only while it still has work today", () => {
    expect(states([0], null)[0]?.items[0]).toBe("John 15:done@0");
    expect(states([0], null, { reopenable: ["john15"] })[0]?.items[0]).toBe(
      "John 15:done:open@0",
    );
    const [passages] = states([0, 1], 2, { reopenable: ["psalm16"] });
    expect(passages?.state).toBe("done");
    expect(passages?.target).toBe(1);
  });

  it("counts each group's items done", () => {
    const groups = todayQueueGroups({
      ...progressInput([0], ["lk9"]),
      current: null,
    });
    expect(groups.map((group) => [group.done, group.total])).toEqual([
      [1, 2],
      [0, 2],
      [1, 2],
    ]);
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
      done: new Set(),
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
      done: new Set(),
      current: 0,
    });
    expect(group?.items).toHaveLength(TODAY_QUEUE_REVIEW_LIMIT + 1);
    expect(group?.moreCount).toBe(0);
  });
});

describe("todayQueueItemStep", () => {
  it("opens the segment and verse a queue item id names", () => {
    expect(
      todayQueueItemStep(QUEUE_SEGMENTS, QUEUE_LEARNING, QUEUE_REVIEWS, "jn2"),
    ).toEqual({ index: 2, verseId: "jn2" });
    expect(
      todayQueueItemStep(
        QUEUE_SEGMENTS,
        QUEUE_LEARNING,
        QUEUE_REVIEWS,
        "psalm16",
      ),
    ).toEqual({ index: 1 });
    expect(
      todayQueueItemStep(
        QUEUE_SEGMENTS,
        QUEUE_LEARNING,
        QUEUE_REVIEWS,
        "missing",
      ),
    ).toBeNull();
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

describe("carryTodayProgress", () => {
  it("leaves the count alone with nothing carried", () => {
    expect(carryTodayProgress({ done: 1, total: 4 }, 0.25, 0)).toEqual({
      counts: { done: 1, total: 4 },
      fraction: 0.25,
    });
  });

  it("adds earlier items to the count and the bar", () => {
    expect(carryTodayProgress({ done: 0, total: 5 }, 0, 8)).toEqual({
      counts: { done: 8, total: 13 },
      fraction: 8 / 13,
    });
  });
});

describe("todaySessionProgress", () => {
  it("moves within a passage given a fractional share", () => {
    const segments = planTodaySession({
      passages: [PSALM_16],
      learningVerses: 0,
      reviews: 0,
    });
    expect(todaySessionProgress(segments, [0.5])).toBe(0.5);
    expect(todaySessionCounts(segments, [0.5])).toEqual({ done: 0, total: 1 });
  });
});
