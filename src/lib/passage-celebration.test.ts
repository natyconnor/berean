import { describe, expect, it } from "vitest";

import {
  celebrationPendingPatch,
  needsCelebration,
} from "../../convex/lib/passageCelebration";

describe("celebrationPendingPatch", () => {
  it("marks the moment pending when a passage graduates from building", () => {
    expect(
      celebrationPendingPatch({ status: "building" }, "reviewing", 500),
    ).toEqual({ celebrationPendingAt: 500 });
    expect(
      celebrationPendingPatch({ status: "building" }, "mastered", 500),
    ).toEqual({ celebrationPendingAt: 500 });
  });

  it("does nothing without a building transition", () => {
    expect(
      celebrationPendingPatch({ status: "building" }, "building", 5),
    ).toEqual({});
    expect(
      celebrationPendingPatch({ status: "reviewing" }, "mastered", 5),
    ).toEqual({});
    expect(
      celebrationPendingPatch({ status: "reviewing" }, "reviewing", 5),
    ).toEqual({});
  });

  it("keeps an earlier celebration or pending time", () => {
    expect(
      celebrationPendingPatch(
        { status: "building", celebratedAt: 1 },
        "reviewing",
        5,
      ),
    ).toEqual({});
    expect(
      celebrationPendingPatch(
        { status: "building", celebrationPendingAt: 2 },
        "reviewing",
        5,
      ),
    ).toEqual({});
  });
});

describe("needsCelebration", () => {
  it("is true only while pending and not yet celebrated", () => {
    expect(needsCelebration({ celebrationPendingAt: 1 })).toBe(true);
    expect(needsCelebration({ celebrationPendingAt: 1, celebratedAt: 2 })).toBe(
      false,
    );
    expect(needsCelebration({})).toBe(false);
    expect(needsCelebration({ celebratedAt: 2 })).toBe(false);
  });
});
