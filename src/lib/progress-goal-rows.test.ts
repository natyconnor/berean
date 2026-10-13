import { describe, expect, it } from "vitest";

import type {
  PackGoalCard,
  PassageGoalCard,
  VerseGoalCard,
} from "./memory-goals";
import {
  estimateReviewDaysToMastery,
  formatMasteryDuration,
} from "./memorize-plan";
import { DAY_MS } from "./memory-scheduler";
import { goalProgressRow } from "./progress-goal-rows";

const NOW = Date.UTC(2026, 9, 9, 18, 0, 0);
const TZ = "UTC";
const AFTER_LEARNING = `${formatMasteryDuration(estimateReviewDaysToMastery(), { short: true })} after learning`;

function passage(overrides: Partial<PassageGoalCard> = {}): PassageGoalCard {
  return {
    kind: "passage",
    packId: "psalm16",
    title: "Psalm 16",
    verseCount: 11,
    learnedVerses: 4,
    status: "building",
    hasWorkToday: true,
    todayStep: null,
    masteryFraction: 0,
    nextDueAt: NOW,
    createdAt: NOW - 10 * DAY_MS,
    lastActivityAt: NOW - 60_000,
    lastPracticedAt: NOW - 60_000,
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
      { verseRefId: "a", label: "Luke 9:23–24" },
      { verseRefId: "b", label: "Matthew 6:33" },
    ],
    learningToday: 0,
    reviewTogether: false,
    hasWorkToday: true,
    nextDueAt: NOW,
    createdAt: NOW - 30 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    memberLabels: [],
    ...overrides,
  };
}

function verse(overrides: Partial<VerseGoalCard> = {}): VerseGoalCard {
  return {
    kind: "verse",
    verseRefId: "v",
    title: "John 3:16",
    book: "John",
    chapter: 3,
    startVerse: 16,
    endVerse: 16,
    status: "reviewing",
    learnStage: 3,
    intervalDays: 6,
    masteryFraction: 0.15,
    hasWorkToday: false,
    nextDueAt: NOW + 2 * DAY_MS,
    createdAt: NOW - 20 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    ...overrides,
  };
}

describe("goalProgressRow", () => {
  it("shows a building passage's learned track and a separate mastery fact", () => {
    const row = goalProgressRow(passage(), NOW, TZ);
    expect(row.kindLabel).toBe("Passage");
    expect(row.learnedLabel).toMatch(
      /^4 of 11 learned · on track for Oct \d+$/,
    );
    expect(row.learnedFraction).toBeCloseTo(4 / 11);
    expect(row.masteryLabel).toBe(AFTER_LEARNING);
    expect(row.masteryFraction).toBe(0);
    expect(row).toMatchObject({ nextLabel: "Today", nextIsToday: true });
  });

  it("drops on-track wording after two idle days", () => {
    const row = goalProgressRow(
      passage({ lastPracticedAt: NOW - 3 * DAY_MS, hasWorkToday: false }),
      NOW,
      TZ,
    );
    expect(row.learnedLabel).toMatch(/^4 of 11 learned · about .+ to go$/);
  });

  it("gives a not-yet-started passage its learn time", () => {
    const row = goalProgressRow(
      passage({ learnedVerses: 0, verseCount: 6, lastPracticedAt: null }),
      NOW,
      TZ,
    );
    expect(row.learnedLabel).toBe("0 of 6 · learn it in about 4 days");
  });

  it("shows mastery for memorized passages", () => {
    expect(
      goalProgressRow(
        passage({
          status: "reviewing",
          learnedVerses: 11,
          masteryFraction: 0.4,
          hasWorkToday: false,
          nextDueAt: NOW + DAY_MS,
        }),
        NOW,
        TZ,
      ),
    ).toMatchObject({
      learnedLabel: "11 of 11 learned",
      masteryLabel: "Mastery 40%",
      nextLabel: "Tomorrow",
      nextIsToday: false,
    });
  });

  it("counts pack reviews due today and both tracks", () => {
    expect(goalProgressRow(pack(), NOW, TZ)).toMatchObject({
      kindLabel: "Pack",
      masteryLabel: "0 of 9 mastered · 22% of the way",
      nextLabel: "2 reviews today",
      nextIsToday: true,
    });
    expect(
      goalProgressRow(pack({ learned: 0, reviewsDue: [] }), NOW, TZ)
        .masteryLabel,
    ).toBe(AFTER_LEARNING);
  });

  it("reads a verse's learning or mastery", () => {
    expect(goalProgressRow(verse(), NOW, TZ)).toMatchObject({
      learnedLabel: "Learned",
      learnedFraction: 1,
      masteryLabel: "Mastery 15%",
      nextIsToday: false,
    });
    expect(
      goalProgressRow(
        verse({ status: "learning", learnStage: 2, hasWorkToday: true }),
        NOW,
        TZ,
      ),
    ).toMatchObject({
      learnedLabel: "Learning",
      learnedFraction: 1 / 3,
      masteryLabel: AFTER_LEARNING,
      nextLabel: "Today",
    });
    expect(
      goalProgressRow(verse({ status: "new", nextDueAt: null }), NOW, TZ),
    ).toMatchObject({ learnedLabel: "Up next", nextLabel: null });
  });
});
