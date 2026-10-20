import { describe, expect, it } from "vitest";

import type { VerseGoalCard } from "./memory-goals";
import { todayGoalCardModel } from "./today-goal-card";

const TZ = "America/Los_Angeles";

/**
 * 12:30 AM PDT Tuesday Oct 20, 2026. 07:30 UTC the same morning, so a UTC
 * runner still needs `TZ` to treat 5:00 AM PDT as later today, not a new day.
 */
const SAME_DAY_NOW = Date.UTC(2026, 9, 20, 7, 30);
/** 5:00 AM PDT Oct 20. */
const SAME_DAY_DUE = Date.UTC(2026, 9, 20, 12, 0);
/** 11:00 PM PDT Monday Oct 19, the session that locked the next step. */
const SAME_DAY_PRACTICED = Date.UTC(2026, 9, 20, 6, 0);

/**
 * 11:00 PM PDT Tuesday Oct 20. 06:00 UTC Oct 21, same UTC day as a 5:00 AM
 * Wednesday unlock, so omitting `TZ` would call that lock later today.
 */
const TOMORROW_NOW = Date.UTC(2026, 9, 21, 6, 0);
/** 5:00 AM PDT Wednesday Oct 21. */
const TOMORROW_DUE = Date.UTC(2026, 9, 21, 12, 0);

function verse(overrides: Partial<VerseGoalCard> = {}): VerseGoalCard {
  return {
    kind: "verse",
    verseRefId: "psalm117",
    title: "Psalm 117",
    book: "Psalms",
    chapter: 117,
    startVerse: 1,
    endVerse: 2,
    status: "learning",
    learnStage: 1,
    intervalDays: 0,
    masteryFraction: 0,
    hasWorkToday: false,
    nextDueAt: SAME_DAY_DUE,
    createdAt: SAME_DAY_PRACTICED,
    lastActivityAt: SAME_DAY_PRACTICED,
    lastPracticedAt: SAME_DAY_PRACTICED,
    ...overrides,
  };
}

function learnedBarDetail(
  goal: VerseGoalCard,
  now: number,
): string | null | undefined {
  return todayGoalCardModel(goal, now, TZ).bars.find(
    (bar) => bar.track === "learned",
  )?.detail;
}

describe("todayGoalCardModel", () => {
  it("says Later today and counts today when a lock opens the same LA day", () => {
    const model = todayGoalCardModel(verse(), SAME_DAY_NOW, TZ);

    expect(model.steps).toEqual([
      { kind: "note", text: "Later today: fill in the blanks." },
    ]);
    expect(learnedBarDetail(verse(), SAME_DAY_NOW)).toBe("on track for Oct 22");
    expect(
      learnedBarDetail(
        verse({
          hasWorkToday: true,
          lastPracticedAt: SAME_DAY_PRACTICED,
          lastActivityAt: SAME_DAY_PRACTICED,
        }),
        Date.UTC(2026, 9, 20, 12, 30),
      ),
    ).toBe("on track for Oct 22");
  });

  it("keeps Tomorrow when the lock opens the next LA calendar day", () => {
    const model = todayGoalCardModel(
      verse({
        nextDueAt: TOMORROW_DUE,
        lastPracticedAt: TOMORROW_NOW,
        lastActivityAt: TOMORROW_NOW,
        createdAt: TOMORROW_NOW,
      }),
      TOMORROW_NOW,
      TZ,
    );

    expect(model.steps).toEqual([
      { kind: "done", text: "Today's step done. Tomorrow: fill in the blanks." },
    ]);
    expect(
      learnedBarDetail(
        verse({
          nextDueAt: TOMORROW_DUE,
          lastPracticedAt: TOMORROW_NOW,
          lastActivityAt: TOMORROW_NOW,
          createdAt: TOMORROW_NOW,
        }),
        TOMORROW_NOW,
      ),
    ).toBe("on track for Oct 23");
  });
});
