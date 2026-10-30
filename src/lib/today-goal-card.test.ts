import { describe, expect, it } from "vitest";

import type { PassageGoalCard, VerseGoalCard } from "./memory-goals";
import { DAY_MS } from "./memory-scheduler";
import { todayGoalCardModel } from "./today-goal-card";

const TZ = "America/Los_Angeles";

const OCT20_12_30_AM = Date.UTC(2026, 9, 20, 7, 30);
const OCT20_5_AM = Date.UTC(2026, 9, 20, 12, 0);
const OCT19_11_PM = Date.UTC(2026, 9, 20, 6, 0);
/** 11:00 PM PDT Oct 20 and 5:00 AM PDT Oct 21 are both Oct 21 in UTC. */
const OCT20_11_PM = Date.UTC(2026, 9, 21, 6, 0);
const OCT21_5_AM = Date.UTC(2026, 9, 21, 12, 0);

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
    nextDueAt: OCT20_5_AM,
    createdAt: OCT19_11_PM,
    lastActivityAt: OCT19_11_PM,
    lastPracticedAt: OCT19_11_PM,
    ...overrides,
  };
}

function learnedBarDetail(
  goal: VerseGoalCard,
  now: number,
  timeZone = TZ,
): string | null | undefined {
  return todayGoalCardModel(goal, now, timeZone).bars.find(
    (bar) => bar.track === "learned",
  )?.detail;
}

describe("todayGoalCardModel", () => {
  it("says Later today and counts today when a lock opens the same LA day", () => {
    const model = todayGoalCardModel(verse(), OCT20_12_30_AM, TZ);

    expect(model.steps).toEqual([
      { kind: "note", text: "Later today: fill in the blanks." },
    ]);
    expect(learnedBarDetail(verse(), OCT20_12_30_AM)).toBe(
      "on track for Oct 22",
    );
    expect(
      learnedBarDetail(
        verse({
          hasWorkToday: true,
          lastPracticedAt: OCT19_11_PM,
          lastActivityAt: OCT19_11_PM,
        }),
        Date.UTC(2026, 9, 20, 12, 30),
      ),
    ).toBe("on track for Oct 22");
  });

  it("keeps Tomorrow when the lock opens the next LA calendar day", () => {
    const locked = verse({
      nextDueAt: OCT21_5_AM,
      lastPracticedAt: OCT20_11_PM,
      lastActivityAt: OCT20_11_PM,
      createdAt: OCT20_11_PM,
    });
    const model = todayGoalCardModel(locked, OCT20_11_PM, TZ);

    expect(model.steps).toEqual([
      {
        kind: "done",
        text: "Today's step done. Tomorrow: fill in the blanks.",
      },
    ]);
    expect(learnedBarDetail(locked, OCT20_11_PM)).toBe("on track for Oct 23");
    expect(todayGoalCardModel(locked, OCT20_11_PM, "UTC").steps).toEqual([
      {
        kind: "done",
        text: "Today's step done. Later today: fill in the blanks.",
      },
    ]);
  });
});

describe("todayGoalCardModel after passage Start over", () => {
  const NOW = Date.UTC(2026, 9, 12, 18);

  function buildingPassage(
    overrides: Partial<PassageGoalCard> = {},
  ): PassageGoalCard {
    return {
      kind: "passage",
      packId: "psalm1",
      title: "Psalm 1",
      verseCount: 6,
      learnedVerses: 0,
      pieceStates: [
        { verses: 2, state: "upNext", today: false },
        { verses: 2, state: "upNext", today: false },
        { verses: 2, state: "upNext", today: false },
      ],
      status: "building",
      hasWorkToday: true,
      todayStep: {
        label: "Read verses 1–2, then type them with first letters",
        ladderDay: 1,
      },
      masteryFraction: 0,
      nextDueAt: NOW,
      createdAt: NOW - 5 * DAY_MS,
      lastActivityAt: NOW - 5 * DAY_MS,
      lastPracticedAt: null,
      ...overrides,
    };
  }

  it("offers today's first step again with Learn, and no Done today chip or tint", () => {
    const model = todayGoalCardModel(buildingPassage(), NOW, "UTC");

    expect(model.chip).toBeNull();
    expect(model.steps).toEqual([
      {
        kind: "learn",
        lead: "Today:",
        rest: "read verses 1–2, then type them with first letters.",
      },
    ]);
    expect(model.action).toMatchObject({
      kind: "learn",
      label: "Start · 7 min",
    });
    expect(model.signature.kind).toBe("passage");
    if (model.signature.kind !== "passage") throw new Error("expected passage");
    expect(model.signature.ticks.every((tick) => tick.today === false)).toBe(
      true,
    );
  });

  it("still marks Done today when last practice was today and there is no work left", () => {
    const model = todayGoalCardModel(
      buildingPassage({
        hasWorkToday: false,
        todayStep: null,
        lastPracticedAt: NOW - 60_000,
        lastActivityAt: NOW - 60_000,
      }),
      NOW,
      "UTC",
    );

    expect(model.chip).toEqual({ tone: "done", label: "Done today" });
    expect(model.action).toBeNull();
  });
});
