import { describe, expect, it } from "vitest";

import { goalLayoutFor } from "./today-goal-layout";

describe("goalLayoutFor", () => {
  it("pins the rail when wide, then a grid, then one sideways row", () => {
    expect(goalLayoutFor(1440)).toEqual({ kind: "rail" });
    expect(goalLayoutFor(1120)).toEqual({ kind: "rail" });
    expect(goalLayoutFor(1119)).toEqual({ kind: "grid", columns: 3 });
    expect(goalLayoutFor(1000)).toEqual({ kind: "grid", columns: 3 });
    expect(goalLayoutFor(999)).toEqual({ kind: "grid", columns: 2 });
    expect(goalLayoutFor(860)).toEqual({ kind: "grid", columns: 2 });
    expect(goalLayoutFor(859)).toEqual({ kind: "shelf" });
    expect(goalLayoutFor(390)).toEqual({ kind: "shelf" });
  });
});
