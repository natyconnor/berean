import { describe, expect, it } from "vitest";

import { practicedDaysCopy, practicedDaysIn, streakCopy } from "./streak-copy";

describe("streakCopy", () => {
  it("hides a streak under two days", () => {
    expect(streakCopy(0)).toBeNull();
    expect(streakCopy(1)).toBeNull();
  });

  it("names a 2–6 day streak plainly", () => {
    expect(streakCopy(2)).toEqual({
      label: "2-day streak",
      note: null,
      sentence: "2-day streak",
    });
    expect(streakCopy(6)?.sentence).toBe("6-day streak");
  });

  it("adds Faithful in little from a week on", () => {
    expect(streakCopy(7)).toEqual({
      label: "7-day streak",
      note: "Faithful in little.",
      sentence: "7-day streak. Faithful in little.",
    });
    expect(streakCopy(40)?.sentence).toBe("40-day streak. Faithful in little.");
  });

  it("never says the old nudges", () => {
    for (const days of [0, 1, 2, 3, 7, 30]) {
      expect(streakCopy(days)?.sentence ?? "").not.toMatch(
        /Keep it going|Day one|lost|reset/,
      );
    }
  });
});

describe("practicedDaysIn", () => {
  it("counts practiced days in the last week, today last", () => {
    expect(practicedDaysIn([5, 5, 5, 0, 1, 0, 0, 2, 0, 3])).toBe(3);
    expect(practicedDaysIn([0, 0])).toBe(0);
    expect(practicedDaysIn([])).toBe(0);
  });
});

describe("practicedDaysCopy", () => {
  it("says how many of the last 7 days had practice", () => {
    expect(practicedDaysCopy(4)).toBe("Practiced 4 of the last 7 days");
    expect(practicedDaysCopy(1)).toBe("Practiced 1 of the last 7 days");
    expect(practicedDaysCopy(0)).toBe("No practice in the last 7 days");
  });
});
