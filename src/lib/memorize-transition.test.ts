import { describe, expect, it } from "vitest";

import { planMemorizeTransition } from "./memorize-transition";

describe("planMemorizeTransition", () => {
  it("adds a verse memorized on its own as learning", () => {
    expect(planMemorizeTransition(null, false)).toEqual({
      result: "added",
      status: "learning",
      statsFrom: null,
    });
  });

  it("adds a pack member as up next", () => {
    expect(planMemorizeTransition(null, true)).toEqual({
      result: "added",
      status: "new",
      statsFrom: null,
    });
  });

  it("is a no-op the second time a verse is memorized", () => {
    const first = planMemorizeTransition(null, false);
    expect(
      planMemorizeTransition({ status: first.status, inMemory: true }, false),
    ).toEqual({ result: "already", status: "learning", statsFrom: "learning" });
  });

  it("resumes a stopped verse with its schedule", () => {
    expect(
      planMemorizeTransition({ status: "reviewing", inMemory: false }, false),
    ).toEqual({ result: "resumed", status: "reviewing", statsFrom: null });
    expect(
      planMemorizeTransition({ status: "learning", inMemory: false }, true),
    ).toEqual({ result: "resumed", status: "learning", statsFrom: null });
  });

  it("treats a row that was never backfilled as not in Memory", () => {
    expect(planMemorizeTransition({ status: "mastered" }, false)).toEqual({
      result: "resumed",
      status: "mastered",
      statsFrom: null,
    });
  });

  it("starts a stopped never-started verse learning unless up next", () => {
    expect(
      planMemorizeTransition({ status: "new", inMemory: false }, false),
    ).toEqual({ result: "resumed", status: "learning", statsFrom: null });
    expect(
      planMemorizeTransition({ status: "new", inMemory: false }, true),
    ).toEqual({ result: "resumed", status: "new", statsFrom: null });
  });

  it("promotes an up-next verse memorized on its own", () => {
    expect(
      planMemorizeTransition({ status: "new", inMemory: true }, false),
    ).toEqual({ result: "promoted", status: "learning", statsFrom: "new" });
  });

  it("leaves an up-next verse alone when added to another pack", () => {
    expect(
      planMemorizeTransition({ status: "new", inMemory: true }, true),
    ).toEqual({ result: "already", status: "new", statsFrom: "new" });
  });

  it("never moves a verse that is already further along", () => {
    for (const status of ["learning", "reviewing", "mastered"] as const) {
      for (const upNext of [false, true]) {
        expect(
          planMemorizeTransition({ status, inMemory: true }, upNext),
        ).toEqual({ result: "already", status, statsFrom: status });
      }
    }
  });
});
