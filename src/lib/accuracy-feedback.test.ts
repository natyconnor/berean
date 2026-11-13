import { describe, expect, it } from "vitest";

import { accuracyBand, BAND_EMOJI } from "./accuracy-feedback";
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

describe("BAND_EMOJI", () => {
  it("saves the party for a perfect attempt", () => {
    expect(BAND_EMOJI.exact).toBe("🎉");
    expect(BAND_EMOJI.pass).toBe("🙌");
    expect(BAND_EMOJI.close).toBe("🌱");
    expect(BAND_EMOJI.miss).toBe("📖");
  });
});
