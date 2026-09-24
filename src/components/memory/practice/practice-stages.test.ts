import { describe, expect, it } from "vitest";

import { currentStageStep, practiceChromeFor } from "./practice-stages";

describe("practiceChromeFor", () => {
  it("maps practice stages onto lifecycle status colors", () => {
    expect(practiceChromeFor(0).dot).toContain("slate");
    expect(practiceChromeFor(1).dot).toContain("amber");
    expect(practiceChromeFor(2).dot).toContain("amber");
    expect(practiceChromeFor(3).dot).toContain("amber");
    expect(practiceChromeFor(3, "learning").dot).toContain("amber");
  });

  it("uses reviewing colors only after the verse has graduated", () => {
    expect(practiceChromeFor(3, "reviewing").dot).toContain("sky");
  });

  it("uses mastered colors once the verse reaches mastered status", () => {
    expect(practiceChromeFor(3, "mastered").dot).toContain("emerald");
  });
});

describe("currentStageStep", () => {
  it("shows the current step, not completed count", () => {
    expect(currentStageStep(0, 5)).toBe(1);
    expect(currentStageStep(1, 5)).toBe(2);
    expect(currentStageStep(4, 5)).toBe(5);
    expect(currentStageStep(5, 5)).toBe(5);
  });
});
