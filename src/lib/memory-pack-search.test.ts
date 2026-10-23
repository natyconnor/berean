import { describe, expect, it } from "vitest";

import { validateMemoryPackSearch } from "./memory-pack-search";

describe("validateMemoryPackSearch", () => {
  it("keeps from=verses", () => {
    expect(validateMemoryPackSearch({ from: "verses" })).toEqual({
      from: "verses",
    });
  });

  it("drops junk and the old create flags", () => {
    expect(
      validateMemoryPackSearch({
        from: "elsewhere",
        heartHint: "1",
        startPassage: true,
      }),
    ).toEqual({});
  });

  it("keeps startOver from the drawer handoff", () => {
    expect(validateMemoryPackSearch({ startOver: "1" })).toEqual({
      startOver: true,
    });
  });
});
