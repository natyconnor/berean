import { describe, expect, it } from "vitest";
import {
  accuracyTooltipCopy,
  formatAccuracyPercent,
  hoverIndexFromX,
  reviewPhrase,
} from "./accuracy-trend";

describe("hoverIndexFromX", () => {
  it("snaps to the nearest day across the view", () => {
    expect(hoverIndexFromX(0, 30, 300)).toBe(0);
    expect(hoverIndexFromX(300, 30, 300)).toBe(29);
    expect(hoverIndexFromX(150, 30, 300)).toBe(15);
  });

  it("clamps out-of-range pointers", () => {
    expect(hoverIndexFromX(-20, 10, 100)).toBe(0);
    expect(hoverIndexFromX(999, 10, 100)).toBe(9);
  });

  it("returns 0 for a single day or empty width", () => {
    expect(hoverIndexFromX(50, 1, 100)).toBe(0);
    expect(hoverIndexFromX(50, 10, 0)).toBe(0);
  });
});

describe("formatAccuracyPercent", () => {
  it("keeps whole percents and one decimal otherwise", () => {
    expect(formatAccuracyPercent(99)).toBe("99%");
    expect(formatAccuracyPercent(99.04)).toBe("99%");
    expect(formatAccuracyPercent(87.5)).toBe("87.5%");
    expect(formatAccuracyPercent(87.54)).toBe("87.5%");
  });
});

describe("accuracyTooltipCopy", () => {
  it("shows percent and review count for a graded day", () => {
    expect(accuracyTooltipCopy({ dayStart: 1, average: 80, count: 2 })).toEqual(
      { headline: "80%", detail: "2 reviews" },
    );
    expect(reviewPhrase(1)).toBe("1 review");
  });

  it("shows an empty state when the day has no reviews", () => {
    expect(
      accuracyTooltipCopy({ dayStart: 1, average: null, count: 0 }),
    ).toEqual({ headline: "No reviews", detail: "0 reviews" });
  });
});
