import { describe, expect, it } from "vitest";

import {
  MEMORIZE_SUGGESTIONS,
  STARTER_SUGGESTION_ID,
  firstRunSuggestions,
  suggestionCollectionHref,
  suggestionTarget,
} from "../../shared/memorize-suggestions";
import {
  getMemoryPreset,
  HUNDRED_VERSES_PRESET_ID,
} from "../../shared/memory-presets";
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

  it("resolves every memorizable suggestion to a valid plan", () => {
    const modes = MEMORIZE_SUGGESTIONS.flatMap((suggestion) => {
      const target = suggestionTarget(suggestion);
      return target
        ? [[suggestion.id, resolveMemorizeTarget(target).mode]]
        : [];
    });
    expect(Object.fromEntries(modes)).toEqual({
      "psalm-23": "passage",
      "lords-prayer": "pack",
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
      title: "The Lord's Prayer",
    });
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
