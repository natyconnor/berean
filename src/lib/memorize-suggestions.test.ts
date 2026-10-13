import { describe, expect, it } from "vitest";

import {
  MEMORIZE_SUGGESTION_POOL,
  MEMORIZE_SUGGESTIONS,
  STARTER_SUGGESTION_ID,
  SUGGESTION_CHIP_COUNT,
  firstRunSuggestions,
  suggestionCollectionHref,
  suggestionSpans,
  suggestionTarget,
  todaySuggestions,
} from "../../shared/memorize-suggestions";
import {
  getMemoryPreset,
  HUNDRED_VERSES_PRESET_ID,
} from "../../shared/memory-presets";
import { MEMORIZE_STATUS_MAX_TARGETS } from "./memorize-status";
import { resolveMemorizeTarget } from "./memorize-target";

describe("memorize suggestions", () => {
  it("offers the planned list, in order", () => {
    expect(MEMORIZE_SUGGESTIONS.map((suggestion) => suggestion.title)).toEqual([
      "Psalm 23",
      "The Lord's Prayer",
      "Romans 8:28",
      "John 3:16",
      "Psalm 1",
      "John 15",
      "1 Corinthians 13",
      "Philippians 4",
      "100 Verses Every Christian Should Know",
    ]);
  });

  it("backs every chapter and the collection with a real preset", () => {
    for (const suggestion of MEMORIZE_SUGGESTIONS) {
      if (suggestion.kind === "verses") continue;
      expect(getMemoryPreset(suggestion.presetId)?.title).toBe(
        suggestion.title,
      );
    }
    const psalm23 = MEMORIZE_SUGGESTIONS[0];
    expect(psalm23).toMatchObject({ kind: "chapter", verseCount: 6 });
  });

  it("resolves every pool suggestion to a valid plan", () => {
    for (const suggestion of MEMORIZE_SUGGESTION_POOL) {
      const target = suggestionTarget(suggestion);
      expect(target && resolveMemorizeTarget(target).mode).not.toBe("invalid");
    }
  });

  it("resolves every memorizable suggestion to a valid plan", () => {
    const modes = MEMORIZE_SUGGESTIONS.flatMap((suggestion) => {
      const target = suggestionTarget(suggestion);
      return target
        ? [[suggestion.id, resolveMemorizeTarget(target).mode]]
        : [];
    });
    expect(Object.fromEntries(modes)).toEqual({
      "psalm-23": "passage",
      "lords-prayer": "passage",
      "romans-8-28": "verse",
      "john-3-16": "verse",
      "psalm-1": "passage",
      "john-15": "passage",
      "1-corinthians-13": "passage",
      "philippians-4": "passage",
    });
  });

  it("keeps the suggestion's name and preset on the target", () => {
    const lordsPrayer = MEMORIZE_SUGGESTIONS.find(
      (suggestion) => suggestion.id === "lords-prayer",
    );
    expect(lordsPrayer && suggestionTarget(lordsPrayer)).toEqual({
      kind: "spans",
      spans: [{ book: "Matthew", chapter: 6, startVerse: 9, endVerse: 13 }],
      presetId: "matthew-6-9-13",
      title: "The Lord's Prayer",
    });
    expect(getMemoryPreset("matthew-6-9-13")?.title).toBe(lordsPrayer?.title);
    expect(suggestionTarget(MEMORIZE_SUGGESTIONS[0])).toMatchObject({
      kind: "chapters",
      presetId: "psalm-23",
      title: "Psalm 23",
    });
  });

  it("sends the collection to its page instead of the sheet", () => {
    const collection = MEMORIZE_SUGGESTIONS.at(-1);
    expect(collection?.kind).toBe("collection");
    expect(collection && suggestionTarget(collection)).toBeNull();
    expect(suggestionCollectionHref(HUNDRED_VERSES_PRESET_ID)).toBe(
      "/memory/presets/100-verses-every-christian-should-know",
    );
  });

  it("leaves John 3:16 out on first run", () => {
    const ids = firstRunSuggestions().map((suggestion) => suggestion.id);
    expect(ids).not.toContain(STARTER_SUGGESTION_ID);
    expect(ids).toHaveLength(MEMORIZE_SUGGESTIONS.length - 1);
  });
});

describe("suggestion pool", () => {
  const curatedIds = MEMORIZE_SUGGESTIONS.filter(
    (suggestion) => suggestion.kind !== "collection",
  ).map((suggestion) => suggestion.id);

  it("starts with the curated suggestions, then the other presets in catalog order", () => {
    const ids = MEMORIZE_SUGGESTION_POOL.map((suggestion) => suggestion.id);
    expect(ids.slice(0, curatedIds.length)).toEqual(curatedIds);
    expect(ids.slice(curatedIds.length, curatedIds.length + 4)).toEqual([
      "psalm-8",
      "psalm-16",
      "psalm-32",
      "psalm-51",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("matthew-6-9-13");
    expect(ids).not.toContain(HUNDRED_VERSES_PRESET_ID);
  });

  it("fits in one memorizeStatuses call, and every suggestion has spans to check", () => {
    expect(MEMORIZE_SUGGESTION_POOL.length).toBeLessThanOrEqual(
      MEMORIZE_STATUS_MAX_TARGETS,
    );
    for (const suggestion of MEMORIZE_SUGGESTION_POOL) {
      expect(suggestionSpans(suggestion).length).toBeGreaterThan(0);
    }
  });

  it("names a passage preset by its reference", () => {
    const byId = (id: string) =>
      MEMORIZE_SUGGESTION_POOL.find((suggestion) => suggestion.id === id);
    expect(byId("matthew-5-7")).toMatchObject({
      kind: "chapter",
      title: "Sermon on the Mount",
      startChapter: 5,
      endChapter: 7,
      detail: "Matthew 5\u20137",
    });
    expect(byId("romans-8-28-39")).toMatchObject({
      kind: "verses",
      title: "More than conquerors",
      detail: "Romans 8:28\u201339",
      span: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 39 },
      presetId: "romans-8-28-39",
    });
    expect(byId("psalm-8")).not.toHaveProperty("detail");
    const sermon = byId("matthew-5-7");
    expect(sermon && suggestionSpans(sermon)).toHaveLength(3);
  });

  it("shows the curated list when nothing is started", () => {
    expect(todaySuggestions(new Set())).toEqual(MEMORIZE_SUGGESTIONS);
  });

  it("skips started suggestions and fills from the pool, keeping the collection last", () => {
    const shown = todaySuggestions(
      new Set(["psalm-23", STARTER_SUGGESTION_ID]),
    );
    expect(shown.map((suggestion) => suggestion.id)).toEqual([
      "lords-prayer",
      "romans-8-28",
      "psalm-1",
      "john-15",
      "1-corinthians-13",
      "philippians-4",
      "psalm-8",
      "psalm-16",
      HUNDRED_VERSES_PRESET_ID,
    ]);
    expect(shown).toHaveLength(SUGGESTION_CHIP_COUNT + 1);
  });
});
