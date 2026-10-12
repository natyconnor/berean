import { describe, expect, it } from "vitest";

import {
  memorizeTitleLabel,
  statusLabel,
  stepDayLine,
  stepShortLabel,
} from "./memory-copy";

describe("stepShortLabel", () => {
  it("names each learning step", () => {
    expect([0, 1, 2, 3].map(stepShortLabel)).toEqual([
      "Read",
      "First letters",
      "Fill in the blanks",
      "From memory",
    ]);
  });

  it("clamps out-of-range stages", () => {
    expect(stepShortLabel(-1)).toBe("Read");
    expect(stepShortLabel(9)).toBe("From memory");
    expect(stepShortLabel(1.7)).toBe("First letters");
    expect(stepShortLabel(Number.NaN)).toBe("Read");
  });
});

describe("stepDayLine", () => {
  it("frames Read and First letters as day 1", () => {
    expect(stepDayLine(0)).toBe(
      "Day 1 of 3: read it, then type it with first letters",
    );
    expect(stepDayLine(1)).toBe(stepDayLine(0));
  });

  it("frames blanks as day 2 and From memory as day 3", () => {
    expect(stepDayLine(2)).toBe("Day 2 of 3: fill in the blanks");
    expect(stepDayLine(3)).toBe("Day 3 of 3: say it from memory");
  });
});

describe("statusLabel", () => {
  it("reads reviewing as Memorized", () => {
    expect(statusLabel("new")).toBe("New");
    expect(statusLabel("learning")).toBe("Learning");
    expect(statusLabel("reviewing")).toBe("Memorized");
    expect(statusLabel("mastered")).toBe("Mastered");
  });
});

describe("memorizeTitleLabel", () => {
  it("names the target", () => {
    expect(memorizeTitleLabel("Psalm 1")).toBe("Memorize Psalm 1");
  });
});
