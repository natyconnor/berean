import { describe, expect, it } from "vitest";

import { accuracyBand, accuracyFeedback } from "./accuracy-feedback";
import {
  LEARN_PROGRESS_ACCURACY,
  REVIEW_LAPSE_ACCURACY,
} from "./memory-scheduler";

describe("accuracyBand", () => {
  it("trusts the grader's exact verdict over the percentage", () => {
    expect(accuracyBand(100, true)).toBe("exact");
    expect(accuracyBand(97, true)).toBe("exact");
  });

  it("splits the rest on the scheduler's thresholds", () => {
    expect(LEARN_PROGRESS_ACCURACY).toBe(85);
    expect(REVIEW_LAPSE_ACCURACY).toBe(60);
    expect(accuracyBand(99, false)).toBe("pass");
    expect(accuracyBand(85, false)).toBe("pass");
    expect(accuracyBand(84, false)).toBe("close");
    expect(accuracyBand(60, false)).toBe("close");
    expect(accuracyBand(59, false)).toBe("miss");
    expect(accuracyBand(0, false)).toBe("miss");
  });
});

describe("accuracyFeedback", () => {
  it("leads each band with its headline", () => {
    expect(accuracyFeedback(100, { exact: true }).headline).toBe(
      "Word for word.",
    );
    expect(accuracyFeedback(92, { exact: false }).headline).toBe(
      "Well remembered. Just a few words to tidy up.",
    );
    expect(accuracyFeedback(70, { exact: false }).headline).toBe(
      "So close. A few words slipped. The highlighted ones are worth another look.",
    );
    expect(accuracyFeedback(40, { exact: false }).headline).toBe(
      "This one needs more time. We'll bring it back sooner.",
    );
  });

  it("drops the miss line on a practice-only try, and only on a miss", () => {
    expect(
      accuracyFeedback(40, { exact: false, unscheduled: true }),
    ).toMatchObject({
      lead: "This one needs more time.",
      rest: "",
      headline: "This one needs more time.",
    });
    expect(accuracyFeedback(70, { exact: false, unscheduled: true })).toEqual(
      accuracyFeedback(70, { exact: false }),
    );
  });

  it("splits the bold lead from the rest", () => {
    expect(accuracyFeedback(70, { exact: false })).toEqual({
      band: "close",
      lead: "So close.",
      rest: "A few words slipped. The highlighted ones are worth another look.",
      headline:
        "So close. A few words slipped. The highlighted ones are worth another look.",
      emoji: "🌱",
    });
    expect(accuracyFeedback(100, { exact: true }).rest).toBe("");
  });

  it("parties only for word for word, with calmer emoji below", () => {
    expect(accuracyFeedback(100, { exact: true }).emoji).toBe("🎉");
    expect(accuracyFeedback(92, { exact: false }).emoji).toBe("🙌");
    expect(accuracyFeedback(70, { exact: false }).emoji).toBe("🌱");
    expect(accuracyFeedback(40, { exact: false }).emoji).toBe("📖");
  });

  it("never leads with a bare percentage", () => {
    for (const accuracy of [0, 30, 59, 60, 84, 85, 99, 100]) {
      const { headline } = accuracyFeedback(accuracy, {
        exact: accuracy === 100,
      });
      expect(headline).not.toMatch(/\d/);
    }
  });

  it("swaps the miss rest when the schedule is held", () => {
    expect(
      accuracyFeedback(40, { exact: false, scheduleHeld: true }).rest,
    ).toBe("Another look will help it stick.");
    expect(
      accuracyFeedback(70, { exact: false, scheduleHeld: true }).rest,
    ).toBe("A few words slipped. The highlighted ones are worth another look.");
  });
});
