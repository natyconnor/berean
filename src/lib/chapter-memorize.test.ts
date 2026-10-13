import { describe, expect, it } from "vitest";

import {
  chapterMemorizeCopy,
  chapterMemorizeState,
  type ChapterMemorizeState,
} from "./chapter-memorize";
import type { PassageHeartInfo } from "./passage-heart-info";

function passage(overrides: Partial<PassageHeartInfo> = {}): PassageHeartInfo {
  return {
    passageMemoryId: "pm_1",
    packId: "pack_1",
    title: "Psalm 1",
    status: "building",
    dueAt: 0,
    learnedVerses: 0,
    totalVerses: 6,
    chapterCount: 1,
    isFirstChapter: true,
    isLastChapter: true,
    startVerse: 1,
    endVerse: 6,
    verseStates: [],
    ...overrides,
  };
}

describe("chapterMemorizeState", () => {
  it("waits for the chapter's hearts", () => {
    expect(chapterMemorizeState("Psalms", 1, undefined)).toBeNull();
  });

  it("offers to memorize a chapter with no passage heart", () => {
    expect(chapterMemorizeState("Psalms", 1, [{}])).toEqual({
      kind: "memorize",
      title: "Psalm 1",
      verseCount: 6,
      learnDays: 4,
    });
  });

  it("shows progress while the chapter's own passage is building", () => {
    expect(
      chapterMemorizeState("Psalms", 1, [{}, { passage: passage() }]),
    ).toEqual({
      kind: "memorizing",
      title: "Psalm 1",
      packId: "pack_1",
      learnedVerses: 0,
      totalVerses: 6,
    });
  });

  it("is memorized once the passage is reviewing or mastered", () => {
    for (const status of ["reviewing", "mastered"] as const) {
      expect(
        chapterMemorizeState("Psalms", 1, [{ passage: passage({ status }) }]),
      ).toEqual({ kind: "memorized", title: "Psalm 1", packId: "pack_1" });
    }
  });

  it("is part of a passage that spans more chapters or part of this one", () => {
    const sermon = passage({
      title: "Sermon on the Mount",
      packId: "pack_sm",
      chapterCount: 3,
      isFirstChapter: false,
      startVerse: 1,
      endVerse: 34,
      learnedVerses: 48,
      totalVerses: 111,
    });
    expect(chapterMemorizeState("Matthew", 6, [{ passage: sermon }])).toEqual({
      kind: "partOf",
      title: "Sermon on the Mount",
      packId: "pack_sm",
      memorized: false,
      learnedVerses: 48,
      totalVerses: 111,
    });

    const partial = passage({ endVerse: 4 });
    expect(
      chapterMemorizeState("Psalms", 1, [{ passage: partial }]),
    ).toMatchObject({ kind: "partOf", title: "Psalm 1" });
  });

  it("is part of a partial-chapter passage that covers only some of it", () => {
    const christHymn = passage({
      title: "Philippians 2:1\u201311",
      packId: "pack_phil",
      startVerse: 1,
      endVerse: 11,
      totalVerses: 11,
    });
    expect(
      chapterMemorizeState("Philippians", 2, [{ passage: christHymn }]),
    ).toMatchObject({
      kind: "partOf",
      title: "Philippians 2:1\u201311",
      packId: "pack_phil",
    });

    const acrossChapters = passage({
      title: "Romans 7:24\u20138:2",
      chapterCount: 2,
      isFirstChapter: false,
      startVerse: 1,
      endVerse: 2,
      totalVerses: 4,
    });
    const romans8 = chapterMemorizeState("Romans", 8, [
      { passage: acrossChapters },
    ]);
    expect(romans8 && chapterMemorizeCopy(romans8).title).toBe(
      "Part of Romans 7:24\u20138:2",
    );
  });

  it("offers a chapter too short for a passage as one verse card", () => {
    expect(chapterMemorizeState("Psalms", 117, [{}])).toEqual({
      kind: "memorize",
      title: "Psalm 117",
      verseCount: 2,
      learnDays: 3,
    });
  });

  it("is null when the chapter cannot be memorized", () => {
    expect(chapterMemorizeState("Psalms", 151, [])).toBeNull();
  });
});

describe("chapterMemorizeCopy", () => {
  const cases: [
    ChapterMemorizeState,
    ReturnType<typeof chapterMemorizeCopy>,
  ][] = [
    [
      { kind: "memorize", title: "Psalm 1", verseCount: 6, learnDays: 4 },
      {
        title: "Memorize Psalm 1",
        detail: "6 verses · learn in about 4 days",
        short: "Memorize",
        label: "Memorize Psalm 1, 6 verses, learn in about 4 days",
      },
    ],
    [
      {
        kind: "memorizing",
        title: "Psalm 1",
        packId: "p",
        learnedVerses: 0,
        totalVerses: 6,
      },
      {
        title: "Memorizing Psalm 1",
        detail: "0 of 6 learned",
        short: "Memorizing",
        label: "Memorizing Psalm 1, 0 of 6 learned",
      },
    ],
    [
      { kind: "memorized", title: "Psalm 1", packId: "p" },
      {
        title: "Memorized ✓",
        detail: "Psalm 1",
        short: "Memorized",
        label: "Memorized Psalm 1",
      },
    ],
    [
      {
        kind: "partOf",
        title: "Sermon on the Mount",
        packId: "p",
        memorized: false,
        learnedVerses: 4,
        totalVerses: 111,
      },
      {
        title: "Part of Sermon on the Mount",
        detail: "Memorizing · 4 of 111 learned",
        short: "Memorizing",
        label: "Part of Sermon on the Mount, memorizing, 4 of 111 learned",
      },
    ],
  ];

  it.each(cases)("words the %o state", (state, copy) => {
    expect(chapterMemorizeCopy(state)).toEqual(copy);
  });
});
