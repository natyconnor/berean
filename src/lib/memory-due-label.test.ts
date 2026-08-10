import { describe, expect, it } from "vitest";

import {
  formatMemoryDueLabel,
  formatMemoryStatusSubtitle,
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

  it("keeps due labels for review-phase verses", () => {
    expect(formatMemoryDueLabel("reviewing", NOW, NOW)).toBe("Due now");
    expect(formatMemoryDueLabel("mastered", NOW + DAY_MS, NOW)).toBe(
      "Tomorrow",
    );
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
