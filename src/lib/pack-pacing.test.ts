import { describe, expect, it } from "vitest";

import type { MemoryStatus } from "./memory-scheduler";
import {
  PACK_ACTIVE_LEARNING_CAP,
  packUpNextAcrossPacks,
  packUpNextVerseRefIds,
  type PacingMember,
} from "./pack-pacing";

function members(...statuses: MemoryStatus[]) {
  return statuses.map((status, index) => ({
    verseRefId: `v${index + 1}`,
    status,
  }));
}

function verse(
  book: string,
  chapter: number,
  startVerse: number,
  status: MemoryStatus = "new",
): PacingMember {
  return {
    verseRefId: `${book} ${chapter}:${startVerse}`,
    book,
    chapter,
    startVerse,
    endVerse: startVerse,
    status,
  };
}

function ids(list: readonly PacingMember[]): string[] {
  return list.map((member) => member.verseRefId);
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

describe("packUpNextAcrossPacks", () => {
  it("lists a verse that is up next in two packs once", () => {
    const shared = verse("Romans", 8, 28);
    const result = packUpNextAcrossPacks([
      {
        packId: "a",
        kind: "custom",
        members: [verse("John", 3, 16), shared, verse("John", 1, 1)],
      },
      {
        packId: "b",
        kind: "custom",
        members: [shared, verse("Psalms", 23, 1)],
      },
    ]);

    expect(ids(result.members)).toEqual([
      "John 3:16",
      "Romans 8:28",
      "John 1:1",
      "Psalms 23:1",
    ]);
    expect(result.byPackId.get("a")).toEqual([
      "John 3:16",
      "Romans 8:28",
      "John 1:1",
    ]);
    expect(result.byPackId.get("b")).toEqual(["Romans 8:28", "Psalms 23:1"]);
  });

  it("counts a shared learning verse toward each pack's cap", () => {
    const shared = verse("Romans", 8, 28, "learning");
    const result = packUpNextAcrossPacks([
      {
        packId: "a",
        kind: "custom",
        members: [
          shared,
          verse("John", 3, 16, "learning"),
          verse("John", 1, 1, "learning"),
          verse("John", 14, 6),
        ],
      },
      {
        packId: "b",
        kind: "custom",
        members: [shared, verse("Psalms", 23, 1), verse("Psalms", 23, 2)],
      },
    ]);

    expect(ids(result.members)).toEqual(["Psalms 23:1", "Psalms 23:2"]);
    expect(result.byPackId.get("a")).toEqual([]);
  });

  it("paces a custom pack in its saved order", () => {
    const result = packUpNextAcrossPacks([
      {
        packId: "a",
        kind: "custom",
        members: [
          verse("Romans", 8, 28),
          verse("Genesis", 1, 1),
          verse("John", 3, 16),
          verse("Exodus", 20, 3),
        ],
      },
    ]);

    expect(ids(result.members)).toEqual([
      "Romans 8:28",
      "Genesis 1:1",
      "John 3:16",
    ]);
  });

  it("paces a scope pack in Bible order", () => {
    const result = packUpNextAcrossPacks([
      {
        packId: "scope",
        kind: "scope",
        members: [
          verse("Romans", 8, 28),
          verse("John", 3, 16),
          verse("Genesis", 1, 2),
          verse("Genesis", 1, 1),
        ],
      },
    ]);

    expect(ids(result.members)).toEqual([
      "Genesis 1:1",
      "Genesis 1:2",
      "John 3:16",
    ]);
  });

  it("returns nothing for no packs", () => {
    const result = packUpNextAcrossPacks([]);
    expect(result.members).toEqual([]);
    expect(result.byPackId.size).toBe(0);
  });
});
