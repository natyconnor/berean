import { describe, expect, it } from "vitest";

import type {
  PackGoalCard,
  PassageGoalCard,
  VerseGoalCard,
} from "./memory-goals";
import {
  dueGoalRows,
  goalPanel,
  goalSessionHref,
  goalStatusLine,
  listLabels,
  recentGoals,
  searchGoals,
} from "./memory-verses-drawer";
import { DAY_MS } from "./memory-scheduler";

const NOW = Date.UTC(2026, 9, 9, 18, 0, 0);
const TZ = "UTC";

function passage(overrides: Partial<PassageGoalCard> = {}): PassageGoalCard {
  return {
    kind: "passage",
    packId: "psalm16",
    title: "Psalm 16",
    verseCount: 11,
    learnedVerses: 4,
    status: "building",
    hasWorkToday: true,
    todayStep: {
      label:
        "Day 1 of 3 for verses 5–6: read them, then type them with first letters",
      ladderDay: 1,
    },
    masteryFraction: 0,
    nextDueAt: NOW,
    createdAt: NOW - 10 * DAY_MS,
    lastActivityAt: NOW - 2 * 60 * 60 * 1000,
    lastPracticedAt: NOW - 2 * 60 * 60 * 1000,
    ...overrides,
  };
}

function pack(overrides: Partial<PackGoalCard> = {}): PackGoalCard {
  return {
    kind: "pack",
    packId: "merced",
    title: "Merced Team",
    verseCount: 9,
    learned: 5,
    learning: 2,
    upNext: 2,
    mastered: 0,
    masteryFraction: 0.22,
    reviewsDue: [
      { verseRefId: "luke", label: "Luke 9:23–24" },
      { verseRefId: "matt", label: "Matthew 6:33" },
      { verseRefId: "deut", label: "Deuteronomy 6:4–5" },
      { verseRefId: "cor", label: "2 Corinthians 4:7–10" },
      { verseRefId: "eph", label: "Ephesians 2:10" },
    ],
    learningToday: 0,
    reviewTogether: false,
    hasWorkToday: true,
    nextDueAt: NOW,
    createdAt: NOW - 30 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    memberLabels: [
      "Luke 9:23–24",
      "Matthew 6:33",
      "Deuteronomy 6:4–5",
      "Romans 12:2",
    ],
    ...overrides,
  };
}

function verse(overrides: Partial<VerseGoalCard> = {}): VerseGoalCard {
  return {
    kind: "verse",
    verseRefId: "rom828",
    title: "Romans 8:28",
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
    status: "learning",
    learnStage: 2,
    intervalDays: 0,
    masteryFraction: 0,
    hasWorkToday: true,
    nextDueAt: NOW - 1000,
    createdAt: NOW - 3 * DAY_MS,
    lastActivityAt: NOW - 3 * DAY_MS,
    lastPracticedAt: null,
    ...overrides,
  };
}

describe("listLabels", () => {
  it("lists up to three and counts the rest", () => {
    expect(listLabels([])).toBe("");
    expect(listLabels(["A"])).toBe("A");
    expect(listLabels(["A", "B"])).toBe("A and B");
    expect(listLabels(["A", "B", "C"])).toBe("A, B and C");
    expect(listLabels(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });
});

describe("dueGoalRows", () => {
  it("makes one row per goal with work today", () => {
    const rows = dueGoalRows([
      passage(),
      pack(),
      verse(),
      verse({ verseRefId: "idle", hasWorkToday: false }),
    ]);

    expect(
      rows.map(({ title, detail, action, tone }) => ({
        title,
        detail,
        action,
        tone,
      })),
    ).toEqual([
      {
        title: "Psalm 16",
        detail:
          "Day 1 of 3 for verses 5–6: read them, then type them with first letters",
        action: "learn",
        tone: "new",
      },
      {
        title: "Merced Team · 5 reviews",
        detail: "Luke 9:23–24, Matthew 6:33, Deuteronomy 6:4–5 and 2 more",
        action: "review",
        tone: "reviewing",
      },
      {
        title: "Romans 8:28",
        detail: "Learning · Day 2 of 3: fill in the blanks",
        action: "learn",
        tone: "learning",
      },
    ]);
  });

  it("puts learning first for a pack with both", () => {
    const [row] = dueGoalRows([pack({ learningToday: 2 })]);
    expect(row?.title).toBe("Merced Team · 2 to learn · 5 reviews");
    expect(row?.action).toBe("learn");

    const [learnOnly] = dueGoalRows([
      pack({ learningToday: 1, reviewsDue: [] }),
    ]);
    expect(learnOnly?.detail).toBe("1 verse to learn today");
  });

  it("recites memorized passages and reviews memorized verses", () => {
    const rows = dueGoalRows([
      passage({ status: "reviewing", todayStep: null }),
      verse({ status: "reviewing", learnStage: 3, intervalDays: 4 }),
    ]);
    expect(rows.map((row) => [row.detail, row.action])).toEqual([
      ["Recite it today", "review"],
      ["Memorized · review due today", "review"],
    ]);
  });
});

describe("goal links", () => {
  it("opens passages and packs as packs, verses as verses", () => {
    expect(goalPanel(passage())).toEqual({ kind: "pack", packId: "psalm16" });
    expect(goalPanel(verse())).toEqual({
      kind: "verse",
      verseRefId: "rom828",
    });
  });

  it("starts the right session", () => {
    expect(goalSessionHref(passage(), "learn")).toBe("/memory/psalm16/learn");
    expect(goalSessionHref(pack(), "review")).toBe("/memory/merced/review");
    expect(
      goalSessionHref(pack({ learningToday: 1, reviewsDue: [] }), "learn"),
    ).toBe("/memory/merced/learn");
    expect(goalSessionHref(pack({ learningToday: 2 }), "learn")).toBe(
      "/memory/today?packId=merced",
    );
    expect(goalSessionHref(verse(), "learn")).toBe(
      "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28",
    );
  });
});

describe("recentGoals", () => {
  it("sorts by latest activity and caps the list", () => {
    const goals = Array.from({ length: 8 }, (_, i) =>
      verse({ verseRefId: `v${i}`, lastActivityAt: NOW - i * 60_000 }),
    );
    const recent = recentGoals([...goals].reverse(), NOW);
    expect(recent.goals.map((goal) => goal.verseRefId)).toEqual([
      "v0",
      "v1",
      "v2",
      "v3",
      "v4",
      "v5",
    ]);
    expect(recent.lastWeek).toBe(true);
  });

  it("says last week only when every row is from the last 7 days", () => {
    const recent = recentGoals(
      [passage(), verse({ lastActivityAt: NOW - 10 * DAY_MS })],
      NOW,
    );
    expect(recent.goals).toHaveLength(2);
    expect(recent.lastWeek).toBe(false);
  });
});

describe("goalStatusLine", () => {
  it("describes each kind in plain words", () => {
    expect(goalStatusLine(passage(), NOW, TZ)).toBe(
      "Passage · 4 of 11 learned · practiced today",
    );
    expect(
      goalStatusLine(
        passage({ lastPracticedAt: null, createdAt: NOW - DAY_MS }),
        NOW,
        TZ,
      ),
    ).toBe("Passage · 4 of 11 learned · added yesterday");
    expect(goalStatusLine(pack(), NOW, TZ)).toBe(
      "Pack · 5 of 9 learned · mastery 22%",
    );
    expect(goalStatusLine(pack({ learned: 0 }), NOW, TZ)).toBe(
      "Pack · 0 of 9 learned",
    );
    expect(goalStatusLine(verse(), NOW, TZ)).toBe(
      "Verse · Learning · Day 2 of 3: fill in the blanks",
    );
  });
});

describe("searchGoals", () => {
  const goals = [passage(), pack(), verse()];

  it("matches titles and pack members", () => {
    expect(searchGoals(goals, "psalm").map((hit) => hit.goal.title)).toEqual([
      "Psalm 16",
    ]);
    expect(searchGoals(goals, "romans 12")).toEqual([
      { goal: goals[1], matchedMember: "Romans 12:2" },
    ]);
  });

  it("treats a hyphen like the en dash in references", () => {
    expect(searchGoals(goals, "luke 9:23-24")).toEqual([
      { goal: goals[1], matchedMember: "Luke 9:23–24" },
    ]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchGoals(goals, "   ")).toEqual([]);
  });
});
