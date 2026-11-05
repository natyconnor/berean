import { describe, expect, it } from "vitest";

import { DAY_MS, LEARN_PROGRESS_ACCURACY } from "./memory-scheduler";
import {
  applyHeldTry,
  countedTryExistsToday,
  dueQueueAfterLeftoverApply,
  emptyHeldAttemptState,
  HELD_ATTEMPT_BACKSTOP_MS,
  holdFirstTry,
  isHoldableColdMiss,
  replaceHeldTry,
  type HeldTry,
} from "./held-verse-attempt";

const DAY_START = 1_700_000_000_000;
const VERSE = "ps23.1";

function miss(overrides: Partial<HeldTry> = {}): HeldTry {
  return {
    id: "held_1",
    verseKey: VERSE,
    accuracy: 70,
    quality: "close",
    answer: "nope",
    attemptedAt: DAY_START + 1_000,
    ...overrides,
  };
}

function countedCount(state: ReturnType<typeof emptyHeldAttemptState>): number {
  return state.counted.filter((row) => row.verseKey === VERSE).length;
}

describe("held first try", () => {
  it("holds without counting, then apply writes the miss once", () => {
    const held = miss();
    const stored = holdFirstTry(emptyHeldAttemptState(), held);
    expect(stored.heldById.get(held.id)).toEqual(held);
    expect(stored.counted).toEqual([]);

    const first = applyHeldTry(stored, held.id);
    expect(first.applied).toEqual(held);
    expect(countedCount(first.state)).toBe(1);
    expect(first.state.counted[0]?.createdAt).toBe(held.attemptedAt);
    expect(first.state.counted[0]?.refresherUsed).toBe(false);
    expect(first.state.heldById.size).toBe(0);

    const second = applyHeldTry(first.state, held.id);
    expect(second.applied).toBeNull();
    expect(countedCount(second.state)).toBe(1);
  });

  it("applies exactly once across Continue, leave, pagehide, fallback, and backstop", () => {
    const held = miss();
    let state = holdFirstTry(emptyHeldAttemptState(), held);
    for (const path of [
      "continue",
      "back",
      "unmount",
      "pagehide",
      "fallback",
      "backstop",
    ] as const) {
      const next = applyHeldTry(state, held.id);
      expect(next.state.heldById.has(held.id), path).toBe(false);
      state = next.state;
    }
    expect(countedCount(state)).toBe(1);
    expect(state.heldById.size).toBe(0);
  });

  it("replaces the held miss with a From memory pass", () => {
    const held = miss();
    const stored = holdFirstTry(emptyHeldAttemptState(), held);
    const replaced = replaceHeldTry(
      stored,
      held.id,
      {
        verseKey: VERSE,
        accuracy: 90,
        quality: "close",
        createdAt: DAY_START + 5_000,
      },
      DAY_START,
    );
    expect(replaced.replaced).toEqual(held);
    expect(replaced.practiceOnly).toBe(false);
    expect(countedCount(replaced.state)).toBe(1);
    expect(replaced.state.counted[0]?.accuracy).toBe(90);
    expect(replaced.state.counted[0]?.refresherUsed).toBe(true);
    expect(replaced.state.heldById.size).toBe(0);
    expect(applyHeldTry(replaced.state, held.id).applied).toBeNull();
  });

  it("replaces the held miss with a From memory miss", () => {
    const held = miss();
    const stored = holdFirstTry(emptyHeldAttemptState(), held);
    const replaced = replaceHeldTry(
      stored,
      held.id,
      {
        verseKey: VERSE,
        accuracy: 40,
        quality: "off",
        createdAt: DAY_START + 5_000,
      },
      DAY_START,
    );
    expect(replaced.practiceOnly).toBe(false);
    expect(replaced.state.counted[0]?.accuracy).toBe(40);
    expect(replaced.state.counted[0]?.refresherUsed).toBe(true);
    expect(countedCount(replaced.state)).toBe(1);
  });

  it("keeps the held miss when step 2 is not committed, then Back applies it", () => {
    const held = miss();
    const stored = holdFirstTry(emptyHeldAttemptState(), held);
    expect(stored.heldById.get(held.id)).toEqual(held);
    const applied = applyHeldTry(stored, held.id);
    expect(applied.applied?.accuracy).toBe(70);
    expect(countedCount(applied.state)).toBe(1);
    expect(applied.state.counted[0]?.refresherUsed).toBe(false);
  });

  it("treats a step 2 save after apply as practice only", () => {
    const held = miss();
    const stored = holdFirstTry(emptyHeldAttemptState(), held);
    const applied = applyHeldTry(stored, held.id).state;
    const raced = replaceHeldTry(
      applied,
      held.id,
      {
        verseKey: VERSE,
        accuracy: 95,
        quality: "close",
        createdAt: DAY_START + 8_000,
      },
      DAY_START,
    );
    expect(raced.practiceOnly).toBe(true);
    expect(countedCount(raced.state)).toBe(1);
    expect(raced.state.counted[0]?.accuracy).toBe(70);
  });

  it("after a held-card reload, leftover apply leaves one counted row and drops the verse from due", () => {
    const held = miss();
    const reloaded = dueQueueAfterLeftoverApply(
      holdFirstTry(emptyHeldAttemptState(), held),
      [VERSE, "other.verse"],
    );
    expect(countedCount(reloaded.state)).toBe(1);
    expect(reloaded.state.heldById.size).toBe(0);
    expect(reloaded.dueKeys).toEqual(["other.verse"]);
  });

  it("after a mid-step-2 reload, leftover apply leaves one counted row and drops the verse from due", () => {
    const held = miss({ id: "held_step2" });
    const midStep2 = holdFirstTry(emptyHeldAttemptState(), held);
    expect(midStep2.heldById.get(held.id)).toEqual(held);
    expect(midStep2.counted).toEqual([]);

    const reloaded = dueQueueAfterLeftoverApply(midStep2, [VERSE]);
    expect(countedCount(reloaded.state)).toBe(1);
    expect(reloaded.state.counted[0]?.accuracy).toBe(70);
    expect(reloaded.state.counted[0]?.refresherUsed).toBe(false);
    expect(reloaded.dueKeys).toEqual([]);
  });

  it("does not hold a pre-try refresher, so backing out counts nothing", () => {
    expect(
      isHoldableColdMiss({
        reviewPhase: true,
        due: true,
        accuracy: 40,
        passAccuracy: LEARN_PROGRESS_ACCURACY,
        refresherOpen: true,
        countedToday: false,
      }),
    ).toBe(false);
    const applied = applyHeldTry(emptyHeldAttemptState(), "missing");
    expect(applied.applied).toBeNull();
    expect(applied.state.counted).toEqual([]);
  });

  it("treats a later round as practice once a counted try exists today", () => {
    const held = miss();
    const applied = applyHeldTry(
      holdFirstTry(emptyHeldAttemptState(), held),
      held.id,
    ).state;
    expect(countedTryExistsToday(applied, VERSE, DAY_START)).toBe(true);
    const practice = replaceHeldTry(
      applied,
      "held_practice",
      {
        verseKey: VERSE,
        accuracy: 100,
        quality: "exact",
        createdAt: DAY_START + 20_000,
      },
      DAY_START,
    );
    expect(practice.practiceOnly).toBe(true);
    expect(countedCount(practice.state)).toBe(1);
  });

  it("replaces an unread held try when the same verse is held again", () => {
    const first = miss({ id: "held_a", accuracy: 70 });
    const second = miss({ id: "held_b", accuracy: 40, quality: "off" });
    const state = holdFirstTry(
      holdFirstTry(emptyHeldAttemptState(), first),
      second,
    );
    expect(state.heldById.get("held_a")).toBeUndefined();
    expect(state.heldById.get("held_b")?.accuracy).toBe(40);
    expect(applyHeldTry(state, "held_a").applied).toBeNull();
    expect(applyHeldTry(state, "held_b").applied?.accuracy).toBe(40);
  });
});

describe("held try backstop", () => {
  it("waits a day so an in-progress refresher is not stolen", () => {
    expect(HELD_ATTEMPT_BACKSTOP_MS).toBe(DAY_MS);
  });
});

describe("isHoldableColdMiss", () => {
  const base = {
    reviewPhase: true,
    due: true,
    accuracy: 70,
    passAccuracy: LEARN_PROGRESS_ACCURACY,
    refresherOpen: false,
    countedToday: false,
  };

  it("holds a due Memorized miss and not a pass", () => {
    expect(isHoldableColdMiss(base)).toBe(true);
    expect(isHoldableColdMiss({ ...base, accuracy: 84 })).toBe(true);
    expect(isHoldableColdMiss({ ...base, accuracy: 85 })).toBe(false);
    expect(isHoldableColdMiss({ ...base, reviewPhase: false })).toBe(false);
    expect(isHoldableColdMiss({ ...base, due: false })).toBe(false);
    expect(isHoldableColdMiss({ ...base, countedToday: true })).toBe(false);
  });
});
