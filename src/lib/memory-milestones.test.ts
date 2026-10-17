import { describe, expect, it } from "vitest";

import {
  firstMasteredCopy,
  firstMemorizedCopy,
  passageMomentDays,
  passageMomentHeadline,
  passageMomentStats,
} from "./memory-milestones";
import { DAY_MS } from "./memory-scheduler";

const MONDAY_9AM_UTC = Date.UTC(2026, 9, 12, 9, 0, 0);

describe("milestone copy", () => {
  it("names the verse that was memorized", () => {
    const copy = firstMemorizedCopy("Psalm 23:1");
    expect(`${copy.lead} ${copy.rest}`).toBe(
      "Psalm 23:1 is memorized. We'll bring it back tomorrow to keep it fresh.",
    );
  });

  it("names the verse or passage that was mastered", () => {
    const copy = firstMasteredCopy("Psalm 1");
    expect(`${copy.title} ${copy.description}`).toBe(
      "Psalm 1 is mastered. A month between reviews and it's still yours.",
    );
  });

  it("says the passage is known by heart", () => {
    expect(passageMomentHeadline("Psalm 23")).toBe(
      "You can say all of Psalm 23 by heart.",
    );
  });
});

describe("passageMomentDays", () => {
  it("counts the start day and today", () => {
    expect(passageMomentDays(MONDAY_9AM_UTC, MONDAY_9AM_UTC + 60_000, 0)).toBe(
      1,
    );
    expect(
      passageMomentDays(MONDAY_9AM_UTC, MONDAY_9AM_UTC + 2 * DAY_MS, 0),
    ).toBe(3);
  });

  it("follows local midnights", () => {
    // 11pm Monday in UTC-7 to 1am Tuesday local is two calendar days.
    const lateMonday = Date.UTC(2026, 9, 13, 6, 0, 0);
    const earlyTuesday = lateMonday + 2 * 60 * 60 * 1000;
    expect(passageMomentDays(lateMonday, earlyTuesday, 420)).toBe(2);
    expect(passageMomentDays(lateMonday, earlyTuesday, 0)).toBe(1);
  });

  it("never drops below one day", () => {
    expect(passageMomentDays(MONDAY_9AM_UTC + DAY_MS, MONDAY_9AM_UTC, 0)).toBe(
      1,
    );
  });
});

describe("passageMomentStats", () => {
  it("pairs verse count and days", () => {
    expect(passageMomentStats(11, 4)).toBe("11 verses · 4 days");
    expect(passageMomentStats(1, 1)).toBe("1 verse · 1 day");
  });
});
