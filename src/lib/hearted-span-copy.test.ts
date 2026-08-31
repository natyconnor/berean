import { describe, expect, it } from "vitest";

import {
  alreadyHeartedLeadIn,
  heartedSpanConfirmAction,
} from "./hearted-span-copy";

describe("alreadyHeartedLeadIn", () => {
  it("treats unknown and new as hearted-only", () => {
    expect(alreadyHeartedLeadIn()).toBe("You've already hearted");
    expect(alreadyHeartedLeadIn("new")).toBe("You've already hearted");
  });

  it("names learning, reviewing, and mastered distinctly", () => {
    expect(alreadyHeartedLeadIn("learning")).toBe(
      "You've already started learning",
    );
    expect(alreadyHeartedLeadIn("reviewing")).toBe("You're already reviewing");
    expect(alreadyHeartedLeadIn("mastered")).toBe("You've already memorized");
  });
});

describe("heartedSpanConfirmAction", () => {
  const now = 1_000_000;

  it("keeps pack Add unchanged", () => {
    expect(
      heartedSpanConfirmAction("Add", { status: "mastered" }, now),
    ).toEqual({ label: "Add", disabled: false });
  });

  it("uses Learn for new or unhearted spans", () => {
    expect(heartedSpanConfirmAction("Learn")).toEqual({
      label: "Learn",
      disabled: false,
    });
    expect(heartedSpanConfirmAction("Learn", { status: "new" }, now)).toEqual({
      label: "Learn",
      disabled: false,
    });
  });

  it("uses Continue Learning for unlocked learning", () => {
    expect(
      heartedSpanConfirmAction(
        "Learn",
        { status: "learning", dueAt: now },
        now,
      ),
    ).toEqual({ label: "Continue Learning", disabled: false });
  });

  it("uses Tomorrow when learning is session-locked", () => {
    expect(
      heartedSpanConfirmAction(
        "Learn",
        { status: "learning", dueAt: now + 86_400_000, lastReviewedAt: now },
        now,
      ),
    ).toEqual({ label: "Tomorrow", disabled: true });
  });

  it("uses Review for due reviewing and mastered verses", () => {
    expect(
      heartedSpanConfirmAction(
        "Learn",
        { status: "reviewing", dueAt: now },
        now,
      ),
    ).toEqual({ label: "Review", disabled: false });
    expect(
      heartedSpanConfirmAction(
        "Learn",
        { status: "mastered", dueAt: now - 1 },
        now,
      ),
    ).toEqual({ label: "Review", disabled: false });
  });

  it("uses Practice when the next review is still ahead", () => {
    expect(
      heartedSpanConfirmAction(
        "Learn",
        { status: "reviewing", dueAt: now + 86_400_000 },
        now,
      ),
    ).toEqual({ label: "Practice", disabled: false });
    expect(
      heartedSpanConfirmAction("Learn", { status: "mastered" }, now),
    ).toEqual({ label: "Practice", disabled: false });
  });
});
