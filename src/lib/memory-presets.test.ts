import { describe, expect, it } from "vitest";
import { resolveMemorizeTarget } from "@/lib/memorize-target";
import {
  packAllowsPassageMode,
  rangeAllowsPassageMode,
} from "@/lib/passage-eligibility";
import { validateVerseRefBounds } from "../../shared/verse-ref-validation";
import {
  HUNDRED_VERSES_PRESET_ID,
  assertPresetCatalogValid,
  chapterPresetRange,
  chapterPresetScope,
  chapterPresetTarget,
  chapterPresetVerseCount,
  chapterPresets,
  formatChapterRange,
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

    const chapterIds = chapterPresets().map((preset) => preset.id);
    expect(chapterIds).toContain("matthew-5-7");
    expect(chapterIds).not.toContain("matthew-5");
    expect(chapterIds).not.toContain("matthew-6");
    expect(chapterIds).not.toContain("matthew-7");
    expect(getMemoryPreset("matthew-5-7")).toMatchObject({
      title: "Sermon on the Mount",
      startChapter: 5,
      endChapter: 7,
    });
  });

  it("passes its own catalog check", () => {
    expect(() => assertPresetCatalogValid()).not.toThrow();
  });

  it.each([
    [
      "matthew-6-9-13",
      "The Lord's Prayer",
      "Matthew 6:9\u201313",
      5,
      "Gospels",
    ],
    [
      "philippians-2-5-11",
      "The Christ Hymn",
      "Philippians 2:5\u201311",
      7,
      "Letters",
    ],
    [
      "romans-8-28-39",
      "More than conquerors",
      "Romans 8:28\u201339",
      12,
      "Letters",
    ],
  ])(
    "offers %s as a partial-chapter passage",
    (id, title, reference, verseCount, group) => {
      const preset = getMemoryPreset(id);
      expect(preset?.kind).toBe("chapter");
      if (preset?.kind !== "chapter") return;
      expect(preset).toMatchObject({ title, group });
      expect(formatChapterRange(preset)).toBe(reference);
      expect(chapterPresetVerseCount(preset)).toBe(verseCount);
      const range = chapterPresetRange(preset);
      expect(range && rangeAllowsPassageMode(range)).toBe(true);

      const resolved = resolveMemorizeTarget(chapterPresetTarget(preset));
      expect(resolved).toMatchObject({
        mode: "passage",
        title,
        presetId: id,
        range,
        verseCount,
      });
    },
  );

  it("keeps whole-chapter presets as chapter targets without a range", () => {
    const psalm23 = getMemoryPreset("psalm-23");
    if (psalm23?.kind !== "chapter") throw new Error("missing");
    expect(chapterPresetRange(psalm23)).toBeNull();
    expect(chapterPresetTarget(psalm23)).toEqual({
      kind: "chapters",
      book: "Psalms",
      startChapter: 23,
      endChapter: 23,
      presetId: "psalm-23",
    });
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
