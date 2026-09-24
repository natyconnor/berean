import { describe, expect, it } from "vitest";
import { packAllowsPassageMode } from "@/lib/passage-eligibility";
import { validateVerseRefBounds } from "../../shared/verse-ref-validation";
import {
  HUNDRED_VERSES_PRESET_ID,
  chapterPresetScope,
  chapterPresetVerseCount,
  chapterPresets,
  formatPresetPassage,
  getMemoryPreset,
  passagesForCollectionStart,
} from "../../shared/memory-presets";

describe("memory presets", () => {
  it("stores lettered partials as whole verses", () => {
    const collection = getMemoryPreset(HUNDRED_VERSES_PRESET_ID);
    expect(collection?.kind).toBe("collection");
    if (collection?.kind !== "collection") return;

    expect(formatPresetPassage(collection.passages[0])).toBe("Exodus 19:4-6");
    const clipped = [
      "Isaiah 55:1-3",
      "Zechariah 4:6",
      "Luke 12:48",
      "Acts 3:19-20",
      "1 Corinthians 9:22",
    ];
    const labels = collection.passages.map(formatPresetPassage);
    for (const label of clipped) {
      expect(labels).toContain(label);
    }
    expect(labels.some((label) => /[a-z]$/.test(label))).toBe(false);
  });

  it("validates every collection passage and chapter preset", () => {
    const collection = getMemoryPreset(HUNDRED_VERSES_PRESET_ID);
    expect(collection?.kind).toBe("collection");
    if (collection?.kind !== "collection") return;

    expect(collection.passages.length).toBeGreaterThan(100);
    const ids = new Set<string>();
    for (const passage of collection.passages) {
      expect(ids.has(passage.id)).toBe(false);
      ids.add(passage.id);
      expect(
        validateVerseRefBounds({
          book: passage.book,
          chapter: passage.chapter,
          startVerse: passage.startVerse,
          endVerse: passage.endVerse,
        }).valid,
      ).toBe(true);
    }

    for (const preset of chapterPresets()) {
      expect(packAllowsPassageMode(chapterPresetScope(preset))).toBe(true);
      expect(chapterPresetVerseCount(preset)).toBeGreaterThan(0);
    }
  });

  it("treats a full id list as the whole collection, in catalog order", () => {
    const collection = getMemoryPreset(HUNDRED_VERSES_PRESET_ID);
    if (collection?.kind !== "collection") throw new Error("missing");
    const reversed = [...collection.passages].reverse().map((p) => p.id);
    const started = passagesForCollectionStart(collection, reversed);
    expect(started.full).toBe(true);
    expect(started.passages.map((p) => p.id)).toEqual(
      collection.passages.map((p) => p.id),
    );

    const subset = passagesForCollectionStart(collection, [
      collection.passages[2].id,
      collection.passages[0].id,
    ]);
    expect(subset.full).toBe(false);
    expect(subset.passages.map((p) => p.id)).toEqual([
      collection.passages[0].id,
      collection.passages[2].id,
    ]);
  });
});
