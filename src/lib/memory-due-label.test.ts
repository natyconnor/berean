import { describe, expect, it } from "vitest";

import {
  formatMemoryDueLabel,
  formatMemoryStatusCaption,
  formatMemoryStatusSubtitle,
  formatNextReviewPhrase,
  formatReviewIntervalPhrase,
} from "./memory-due-label";

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("formatMemoryDueLabel", () => {
  it("omits due labels for available learning-phase verses", () => {
    expect(formatMemoryDueLabel("new", NOW, NOW)).toBeNull();
    expect(formatMemoryDueLabel("learning", NOW, NOW)).toBeNull();
  });

  it("shows Tomorrow for soft-locked learning verses", () => {
    expect(formatMemoryDueLabel("learning", NOW + DAY_MS, NOW)).toBe(
      "Tomorrow",
    );
  });

  it("says Later today when a lock unlocks later the same local day", () => {
    expect(
      formatMemoryDueLabel(
        "learning",
        new Date(2026, 5, 15, 5, 57).getTime(),
        new Date(2026, 5, 15, 0, 30).getTime(),
      ),
    ).toBe("Later today");
  });

  it("omits the lock label once the unlock time has passed", () => {
    expect(
      formatMemoryDueLabel(
        "learning",
        new Date(2026, 5, 15, 5, 57).getTime(),
        new Date(2026, 5, 15, 6, 10).getTime(),
      ),
    ).toBeNull();
  });

  it("says Tomorrow when a lock unlocks the next local calendar day", () => {
    expect(
      formatMemoryDueLabel(
        "learning",
        new Date(2026, 5, 16, 5, 57).getTime(),
        new Date(2026, 5, 15, 23).getTime(),
      ),
    ).toBe("Tomorrow");
  });

  it("counts In N days by local calendar day for locked learning", () => {
    expect(
      formatMemoryDueLabel(
        "learning",
        new Date(2026, 5, 18, 5, 57).getTime(),
        new Date(2026, 5, 15, 12, 30).getTime(),
      ),
    ).toBe("In 3 days");
  });

  it("counts two calendar days across a spring-forward night, not rounded hours", () => {
    expect(
      formatMemoryDueLabel(
        "learning",
        new Date(2026, 2, 10, 5, 57).getTime(),
        new Date(2026, 2, 8, 23).getTime(),
      ),
    ).toBe("In 2 days");
  });

  it("does not lock or date unstarted verses", () => {
    expect(formatMemoryDueLabel("new", NOW + DAY_MS, NOW)).toBeNull();
  });

  it("does not treat in-progress learning as locked against a stale clock", () => {
    const staleNow = NOW - 3 * 60 * 60 * 1000;
    expect(formatMemoryDueLabel("learning", NOW, staleNow, NOW)).toBeNull();
  });

  it("keeps due labels for review-phase verses", () => {
    expect(formatMemoryDueLabel("reviewing", NOW, NOW)).toBe("Due now");
    expect(formatMemoryDueLabel("mastered", NOW + DAY_MS, NOW)).toBe(
      "Tomorrow",
    );
  });

  it("says Tomorrow for next local midnight at 9 AM, 12:30 PM, and 11 PM", () => {
    const nextMidnight = new Date(2026, 5, 16).getTime();
    for (const now of [
      new Date(2026, 5, 15, 9).getTime(),
      new Date(2026, 5, 15, 12, 30).getTime(),
      new Date(2026, 5, 15, 23).getTime(),
    ]) {
      expect(formatMemoryDueLabel("reviewing", nextMidnight, now)).toBe(
        "Tomorrow",
      );
    }
  });

  it("says Tomorrow just after midnight the day before next local midnight", () => {
    expect(
      formatMemoryDueLabel(
        "reviewing",
        new Date(2026, 5, 16).getTime(),
        new Date(2026, 5, 15, 0, 1).getTime(),
      ),
    ).toBe("Tomorrow");
  });

  it("says Due today only when dueAt is later today", () => {
    expect(
      formatMemoryDueLabel(
        "reviewing",
        new Date(2026, 5, 15, 18).getTime(),
        new Date(2026, 5, 15, 9).getTime(),
      ),
    ).toBe("Due today");
  });

  it("says Due now when dueAt has already passed", () => {
    expect(
      formatMemoryDueLabel(
        "reviewing",
        new Date(2026, 5, 15, 8).getTime(),
        new Date(2026, 5, 15, 9).getTime(),
      ),
    ).toBe("Due now");
  });

  it("counts In N days by local calendar day, not rounded hours", () => {
    expect(
      formatMemoryDueLabel(
        "reviewing",
        new Date(2026, 5, 18).getTime(),
        new Date(2026, 5, 15, 23).getTime(),
      ),
    ).toBe("In 3 days");
  });
});

describe("formatNextReviewPhrase", () => {
  it("omits the clause until a schedule exists", () => {
    expect(formatNextReviewPhrase(null, NOW)).toBeNull();
    expect(formatNextReviewPhrase(undefined, NOW)).toBeNull();
  });

  it("says soon while the verse is still learning", () => {
    expect(
      formatNextReviewPhrase({ status: "learning", dueAt: NOW + DAY_MS }, NOW),
    ).toBe("soon");
  });

  it("lowercases the review due label", () => {
    expect(
      formatNextReviewPhrase(
        { status: "reviewing", dueAt: NOW + 2 * DAY_MS },
        NOW,
      ),
    ).toBe("in 2 days");
  });

  it("names tomorrow after an afternoon exact whose dueAt is next local midnight", () => {
    expect(
      formatNextReviewPhrase(
        {
          status: "reviewing",
          dueAt: new Date(2026, 5, 16).getTime(),
        },
        new Date(2026, 5, 15, 12, 30).getTime(),
      ),
    ).toBe("tomorrow");
  });
});

describe("formatReviewIntervalPhrase", () => {
  it("names a 1-day gap as 1 day", () => {
    expect(formatReviewIntervalPhrase(1)).toBe("1 day");
  });

  it("names multi-day gaps in days", () => {
    expect(formatReviewIntervalPhrase(2)).toBe("2 days");
    expect(formatReviewIntervalPhrase(5.4)).toBe("5 days");
  });

  it("omits missing gaps and floors empty ones to 1 day", () => {
    expect(formatReviewIntervalPhrase(undefined)).toBeNull();
    expect(formatReviewIntervalPhrase(0)).toBe("1 day");
  });
});

describe("formatMemoryStatusSubtitle", () => {
  it("returns only the status label when the due label is hidden", () => {
    expect(
      formatMemoryStatusSubtitle({
        status: "learning",
        statusLabel: "Learning",
        dueAt: NOW,
        now: NOW,
      }),
    ).toBe("Learning");
    expect(
      formatMemoryStatusSubtitle({
        status: "new",
        statusLabel: "New",
        dueAt: NOW + 5 * 60 * 1000,
        now: NOW,
      }),
    ).toBe("New");
  });

  it("joins learning status and Tomorrow when soft-locked", () => {
    expect(
      formatMemoryStatusSubtitle({
        status: "learning",
        statusLabel: "Learning",
        dueAt: NOW + DAY_MS,
        now: NOW,
      }),
    ).toBe("Learning · Tomorrow");
  });

  it("joins Learning · Later today without the unlock clock time", () => {
    expect(
      formatMemoryStatusSubtitle({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 15, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 0, 30).getTime(),
      }),
    ).toBe("Learning · Later today");
  });

  it("joins Learning · In 3 days without the unlock clock time", () => {
    expect(
      formatMemoryStatusSubtitle({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 18, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 12, 30).getTime(),
      }),
    ).toBe("Learning · In 3 days");
  });

  it("returns only Learning once the same-day unlock has passed", () => {
    expect(
      formatMemoryStatusSubtitle({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 15, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 6, 10).getTime(),
      }),
    ).toBe("Learning");
  });

  it("joins review status and due label", () => {
    expect(
      formatMemoryStatusSubtitle({
        status: "reviewing",
        statusLabel: "Reviewing",
        dueAt: NOW,
        now: NOW,
      }),
    ).toBe("Reviewing · Due now");
  });
});

describe("formatMemoryStatusCaption", () => {
  it("puts later-today unlock time only in title and accessible name", () => {
    expect(
      formatMemoryStatusCaption({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 15, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 0, 30).getTime(),
      }),
    ).toEqual({
      text: "Learning · Later today",
      title: "Unlocks at 5:57 AM",
      accessibleName: "Learning, unlocks later today at 5:57 AM",
    });
  });

  it("puts tomorrow unlock time only in title and accessible name", () => {
    expect(
      formatMemoryStatusCaption({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 16, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 23).getTime(),
      }),
    ).toEqual({
      text: "Learning · Tomorrow",
      title: "Unlocks tomorrow at 5:57 AM",
      accessibleName: "Learning, unlocks tomorrow at 5:57 AM",
    });
  });

  it("puts in-N-days unlock time only in title and accessible name", () => {
    expect(
      formatMemoryStatusCaption({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 18, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 12, 30).getTime(),
      }),
    ).toEqual({
      text: "Learning · In 3 days",
      title: "Unlocks in 3 days at 5:57 AM",
      accessibleName: "Learning, unlocks in 3 days at 5:57 AM",
    });
  });

  it("omits title and accessible name once the verse is ready to learn", () => {
    expect(
      formatMemoryStatusCaption({
        status: "learning",
        statusLabel: "Learning",
        dueAt: new Date(2026, 5, 15, 5, 57).getTime(),
        now: new Date(2026, 5, 15, 6, 10).getTime(),
      }),
    ).toEqual({
      text: "Learning",
    });
  });

  it("omits title and accessible name for reviewing labels", () => {
    expect(
      formatMemoryStatusCaption({
        status: "reviewing",
        statusLabel: "Reviewing",
        dueAt: NOW,
        now: NOW,
      }),
    ).toEqual({
      text: "Reviewing · Due now",
    });
  });
});
