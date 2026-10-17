import { describe, expect, it } from "vitest";

import type { PackGoalCard, PassageGoalCard } from "./memory-goals";
import {
  filterGoals,
  goalRowAction,
  goalStage,
  goalStatusSegments,
  sortGoals,
  type GoalSort,
} from "./your-verses-goals";

const NOW = Date.UTC(2026, 9, 15, 18);
const DAY_MS = 24 * 60 * 60 * 1000;

function passage(overrides: Partial<PassageGoalCard> = {}): PassageGoalCard {
  return {
    kind: "passage",
    packId: "psalm23",
    title: "Psalm 23",
    verseCount: 6,
    learnedVerses: 6,
    pieceStates: [{ verses: 6, state: "learned", today: false }],
    status: "reviewing",
    hasWorkToday: false,
    todayStep: null,
    masteryFraction: 0.3,
    nextDueAt: NOW + DAY_MS,
    createdAt: NOW - 20 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    ...overrides,
  };
}

function pack(overrides: Partial<PackGoalCard> = {}): PackGoalCard {
  return {
    kind: "pack",
    packId: "mix",
    title: "Mix",
    verseCount: 4,
    learned: 2,
    learning: 1,
    upNext: 1,
    mastered: 1,
    masteryFraction: 0.26,
    reviewsDue: [],
    learningToday: 0,
    reviewTogether: false,
    hasWorkToday: false,
    nextDueAt: NOW + DAY_MS,
    createdAt: NOW - 10 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    memberLabels: [],
    ...overrides,
  };
}

const PSALM_23 = passage();
const JUDE = passage({
  packId: "jude",
  title: "Jude",
  verseCount: 25,
  learnedVerses: 5,
  status: "building",
  hasWorkToday: true,
  createdAt: NOW - 2 * DAY_MS,
});
const MIX = pack();
const QUEUE = pack({
  packId: "queue",
  title: "Review queue",
  verseCount: 5,
  learned: 5,
  learning: 0,
  upNext: 0,
  mastered: 5,
  hasWorkToday: true,
  createdAt: NOW - 30 * DAY_MS,
});
const GOALS = [JUDE, QUEUE, MIX, PSALM_23];

function titles(goals: readonly { title: string }[]): string[] {
  return goals.map((goal) => goal.title);
}

describe("goalStatusSegments", () => {
  it("splits a pack's verses by status, most learned first", () => {
    expect(goalStatusSegments(MIX)).toEqual([
      { status: "mastered", count: 1 },
      { status: "reviewing", count: 1 },
      { status: "learning", count: 1 },
      { status: "new", count: 1 },
    ]);
  });

  it("reads a building passage's pieces, and a memorized one as one status", () => {
    expect(
      goalStatusSegments(
        passage({
          status: "building",
          pieceStates: [
            { verses: 3, state: "learned", today: false },
            { verses: 1, state: "learning", today: true },
            { verses: 2, state: "upNext", today: false },
          ],
        }),
      ),
    ).toEqual([
      { status: "reviewing", count: 3 },
      { status: "learning", count: 1 },
      { status: "new", count: 2 },
    ]);
    expect(goalStatusSegments(passage({ status: "mastered" }))).toEqual([
      { status: "mastered", count: 6 },
    ]);
  });
});

describe("goalRowAction", () => {
  it("runs today's work when there is some, else Practice", () => {
    expect(goalRowAction(JUDE, NOW, "UTC")).toEqual({
      label: "Continue",
      session: "learn",
      dueToday: true,
    });
    expect(goalRowAction(QUEUE, NOW, "UTC")).toEqual({
      label: "Review",
      session: "review",
      dueToday: true,
    });
    expect(goalRowAction(MIX, NOW, "UTC")).toEqual({
      label: "Practice",
      session: "practice",
      dueToday: false,
    });
    expect(goalRowAction(PSALM_23, NOW, "UTC")).toEqual({
      label: "Practice",
      session: "practice",
      dueToday: false,
    });
  });

  it("starts a pack nobody has practiced and waits on a building passage", () => {
    expect(
      goalRowAction(
        pack({
          learned: 0,
          learning: 0,
          upNext: 4,
          mastered: 0,
          learningToday: 2,
          hasWorkToday: true,
          lastPracticedAt: null,
        }),
        NOW,
        "UTC",
      ),
    ).toMatchObject({ label: "Start", session: "learn" });
    expect(goalRowAction({ ...JUDE, hasWorkToday: false }, NOW, "UTC")).toBe(
      null,
    );
  });
});

describe("goalStage", () => {
  it("learns until every verse is learned, then memorized, then mastered", () => {
    expect(GOALS.map(goalStage)).toEqual([
      "learning",
      "mastered",
      "learning",
      "memorized",
    ]);
    expect(goalStage(pack({ learned: 4, mastered: 1 }))).toBe("memorized");
    expect(goalStage(passage({ status: "mastered" }))).toBe("mastered");
  });
});

describe("filterGoals", () => {
  it("narrows by kind and by stage, with Due today meaning work today", () => {
    expect(titles(filterGoals(GOALS, "passage", null))).toEqual([
      "Jude",
      "Psalm 23",
    ]);
    expect(titles(filterGoals(GOALS, "pack", "learning"))).toEqual(["Mix"]);
    expect(titles(filterGoals(GOALS, "all", "due"))).toEqual([
      "Jude",
      "Review queue",
    ]);
    expect(filterGoals(GOALS, "all", null)).toEqual(GOALS);
  });
});

describe("sortGoals", () => {
  it.each<[GoalSort, string[]]>([
    ["today", ["Jude", "Review queue", "Mix", "Psalm 23"]],
    ["newest", ["Jude", "Mix", "Psalm 23", "Review queue"]],
    ["leastLearned", ["Jude", "Mix", "Review queue", "Psalm 23"]],
    ["name", ["Jude", "Mix", "Psalm 23", "Review queue"]],
  ])("sorts by %s, ties in Today's order", (sort, expected) => {
    expect(titles(sortGoals(GOALS, sort))).toEqual(expected);
  });

  it("orders numbers in names naturally", () => {
    const named = [
      pack({ packId: "b", title: "Psalm 119" }),
      pack({ packId: "a", title: "Psalm 23" }),
    ];
    expect(titles(sortGoals(named, "name"))).toEqual(["Psalm 23", "Psalm 119"]);
  });
});
