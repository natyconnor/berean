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
    expect(accuracyBand(99, false)).toBe("nearly");
    expect(accuracyBand(85, false)).toBe("nearly");
    expect(accuracyBand(84, false)).toBe("progress");
    expect(accuracyBand(60, false)).toBe("progress");
    expect(accuracyBand(59, false)).toBe("again");
    expect(accuracyBand(0, false)).toBe("again");
  });
});

describe("accuracyFeedback", () => {
  it("leads each band with its headline", () => {
    expect(accuracyFeedback(100, { exact: true }).headline).toBe(
      "Word for word.",
    );
    expect(accuracyFeedback(92, { exact: false }).headline).toBe(
      "Nearly there. Just a little to tidy up.",
    );
    expect(accuracyFeedback(70, { exact: false }).headline).toBe(
      "Good progress. The highlighted words are worth another look.",
    );
    expect(accuracyFeedback(40, { exact: false }).headline).toBe(
      "This one needs another pass. We'll bring it back sooner.",
    );
  });

  it("splits the bold lead from the rest", () => {
    expect(accuracyFeedback(70, { exact: false })).toEqual({
      band: "progress",
      lead: "Good progress.",
      rest: "The highlighted words are worth another look.",
      headline: "Good progress. The highlighted words are worth another look.",
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
});
