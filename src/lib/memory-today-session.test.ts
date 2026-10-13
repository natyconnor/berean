import { describe, expect, it } from "vitest";

import {
  planTodaySession,
  todayInterstitialCopy,
  todaySegmentHeader,
  todaySegmentMinutes,
  todaySessionDoneLine,
  todaySessionProgress,
  type TodayPassageInput,
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
});

describe("todayInterstitialCopy", () => {
  it("names the next segment and its time", () => {
    expect(todayInterstitialCopy({ kind: "review", reviewCount: 4 })).toBe(
      "Nice. Next: 4 reviews · about 4 min",
    );
    expect(todayInterstitialCopy({ kind: "review", reviewCount: 1 })).toBe(
      "Nice. Next: 1 review · about 1 min",
    );
    expect(todayInterstitialCopy({ kind: "learning", verseCount: 2 })).toBe(
      "Nice. Next: 2 learning steps · about 6 min",
    );
    expect(
      todayInterstitialCopy({
        kind: "passage",
        packId: "john15",
        title: "John 15",
      }),
    ).toBe("Nice. Next: John 15 · about 7 min");
  });
});

describe("todaySegmentHeader", () => {
  it("reads as the session header for each segment", () => {
    expect(
      todaySegmentHeader({
        kind: "passage",
        packId: "psalm16",
        title: "Psalm 16",
      }),
    ).toBe("Psalm 16 · new verses");
    expect(todaySegmentHeader({ kind: "learning", verseCount: 2 })).toBe(
      "Learning · 2 verses",
    );
    expect(todaySegmentHeader({ kind: "learning", verseCount: 1 })).toBe(
      "Learning · 1 verse",
    );
    expect(todaySegmentHeader({ kind: "review", reviewCount: 5 })).toBe(
      "Review · 5",
    );
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

  it("clamps out-of-range counts and treats an empty plan as done", () => {
    expect(todaySessionProgress(segments, -1)).toBe(0);
    expect(todaySessionProgress(segments, 9)).toBe(1);
    expect(todaySessionProgress([], 0)).toBe(1);
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
