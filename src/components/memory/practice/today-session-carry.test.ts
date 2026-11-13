import { beforeEach, describe, expect, it } from "vitest";

import {
  EMPTY_TODAY_CARRY,
  mergeTodayCarry,
  readTodayCarry,
  writeTodayCarry,
} from "./today-session-carry";

const DAY = 20_000;

describe("today session carry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps each group's done count across a reload", () => {
    writeTodayCarry("all", DAY, {
      ...EMPTY_TODAY_CARRY,
      doneItems: 3,
      groupDone: { passage: 0, learning: 1, review: 2 },
    });
    expect(readTodayCarry("all", DAY)).toMatchObject({
      doneItems: 3,
      groupDone: { passage: 0, learning: 1, review: 2 },
    });
  });

  it("adds a later visit's group counts to the earlier ones", () => {
    const merged = mergeTodayCarry(
      {
        ...EMPTY_TODAY_CARRY,
        doneItems: 2,
        groupDone: { passage: 1, learning: 0, review: 1 },
      },
      {
        ...EMPTY_TODAY_CARRY,
        doneItems: 3,
        groupDone: { passage: 0, learning: 1, review: 2 },
      },
    );
    expect(merged.doneItems).toBe(5);
    expect(merged.groupDone).toEqual({ passage: 1, learning: 1, review: 3 });
  });

  it("reads a record saved before the group counts as none per group", () => {
    localStorage.setItem(
      "berean:today-session:all",
      JSON.stringify({
        day: DAY,
        doneItems: 5,
        passages: [],
        learned: [],
        attempts: [],
      }),
    );
    expect(readTodayCarry("all", DAY)).toEqual({
      ...EMPTY_TODAY_CARRY,
      doneItems: 5,
    });
  });
});
