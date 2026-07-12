import { describe, expect, it } from "vitest";

import { practiceChromeFor } from "./practice-stages";

describe("practiceChromeFor", () => {
  it("maps practice stages onto lifecycle status colors", () => {
    expect(practiceChromeFor(0).dot).toContain("slate");
    expect(practiceChromeFor(1).dot).toContain("amber");
    expect(practiceChromeFor(2).dot).toContain("amber");
    expect(practiceChromeFor(3).dot).toContain("sky");
  });

  it("uses mastered colors once the verse reaches mastered status", () => {
    expect(practiceChromeFor(3, "mastered").dot).toContain("emerald");
  });
});
