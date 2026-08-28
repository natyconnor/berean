import { describe, expect, it } from "vitest";

import {
  formatMemoryDueLabel,
  formatMemoryStatusSubtitle,
  formatNextReviewPhrase,
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

  it("says Tomorrow for a same-calendar-day lock, matching the list CTA", () => {
    // Next local midnight can be < 12h away, which would otherwise round to
    // "Due today" while the row button still says Tomorrow.
    expect(
      formatMemoryDueLabel("learning", NOW + 8 * 60 * 60 * 1000, NOW),
    ).toBe("Tomorrow");
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
