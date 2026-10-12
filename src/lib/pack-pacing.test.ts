import { describe, expect, it } from "vitest";

import type { MemoryStatus } from "./memory-scheduler";
import { PACK_ACTIVE_LEARNING_CAP, packUpNextVerseRefIds } from "./pack-pacing";

function members(...statuses: MemoryStatus[]) {
  return statuses.map((status, index) => ({
    verseRefId: `v${index + 1}`,
    status,
  }));
}

describe("packUpNextVerseRefIds", () => {
  it("caps a pack at three verses learning at once", () => {
    expect(PACK_ACTIVE_LEARNING_CAP).toBe(3);
  });

  it("starts the first three up-next verses when none are learning", () => {
    expect(packUpNextVerseRefIds(members("new", "new", "new", "new"))).toEqual([
      "v1",
      "v2",
      "v3",
    ]);
  });

  it("fills only the open learning slots", () => {
    expect(
      packUpNextVerseRefIds(members("learning", "new", "new", "new")),
    ).toEqual(["v2", "v3"]);
    expect(
      packUpNextVerseRefIds(members("learning", "learning", "new", "new")),
    ).toEqual(["v3"]);
  });

  it("starts nothing once the cap is reached", () => {
    expect(
      packUpNextVerseRefIds(members("learning", "learning", "learning", "new")),
    ).toEqual([]);
    expect(
      packUpNextVerseRefIds(
        members("learning", "learning", "learning", "learning", "new"),
      ),
    ).toEqual([]);
  });

  it("keeps pack order when up-next verses come before learning ones", () => {
    expect(
      packUpNextVerseRefIds(members("new", "new", "learning", "new", "new")),
    ).toEqual(["v1", "v2"]);
  });

  it("does not count memorized or mastered verses toward the cap", () => {
    expect(
      packUpNextVerseRefIds(
        members("reviewing", "mastered", "reviewing", "new", "new", "new"),
      ),
    ).toEqual(["v4", "v5", "v6"]);
  });

  it("returns nothing when no verse is up next", () => {
    expect(packUpNextVerseRefIds(members("reviewing", "learning"))).toEqual([]);
    expect(packUpNextVerseRefIds([])).toEqual([]);
  });

  it("accepts a custom cap", () => {
    expect(packUpNextVerseRefIds(members("new", "new", "new"), 1)).toEqual([
      "v1",
    ]);
  });
});
