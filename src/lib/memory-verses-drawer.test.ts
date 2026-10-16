import { describe, expect, it } from "vitest";

import type {
  PackGoalCard,
  PassageGoalCard,
  VerseGoalCard,
} from "./memory-goals";
import {
  goalPanel,
  goalStatusLine,
  listLabels,
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
    pieceStates: [
      { verses: 4, state: "learned", today: false },
      { verses: 2, state: "learning", today: true },
      { verses: 5, state: "upNext", today: false },
    ],
    status: "building",
    hasWorkToday: true,
    todayStep: {
      label: "Read verses 5–6, then type them with first letters",
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

describe("goal links", () => {
  it("opens passages and packs as packs, verses as verses", () => {
    expect(goalPanel(passage())).toEqual({ kind: "pack", packId: "psalm16" });
    expect(goalPanel(verse())).toEqual({
      kind: "verse",
      verseRefId: "rom828",
    });
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
      "Verse · Learning · Fill in the blanks",
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
