import { describe, expect, it } from "vitest";

import { packListSubtitle } from "./pack-list-subtitle";

describe("packListSubtitle", () => {
  it("shows rope progress for a passage pack", () => {
    expect(
      packListSubtitle({
        kind: "scope",
        verseCount: 2,
        dueCount: 0,
        passageStatus: "building",
        solidCount: 4,
        attachedCount: 1,
        pieceCount: 11,
      }),
    ).toBe("Passage · 4 solid · 1 on rope · 11 pieces");
  });

  it("appends one recitation due for a reviewing passage", () => {
    expect(
      packListSubtitle({
        kind: "scope",
        verseCount: 1,
        dueCount: 1,
        passageStatus: "reviewing",
        solidCount: 11,
        attachedCount: 0,
        pieceCount: 11,
      }),
    ).toBe("Passage · 11 solid · 0 on rope · 11 pieces · one recitation due");
  });

  it("keeps collection copy when there is no passage row", () => {
    expect(
      packListSubtitle({
        kind: "scope",
        verseCount: 3,
        dueCount: 2,
      }),
    ).toBe("Scope · 3 verses · 2 due");
  });
});
