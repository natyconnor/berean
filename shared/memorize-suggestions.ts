import type { VerseSpan } from "../src/lib/hearted-verse-coverage";
import type { MemorizeTarget } from "../src/lib/memorize-target";
import {
  chapterPresetVerseCount,
  getMemoryPreset,
  HUNDRED_VERSES_PRESET_ID,
} from "./memory-presets";

/**
 * Things to memorize offered on Today under "Start something new". Chapters
 * reuse `memory-presets.ts` ids. The Lord's Prayer, Romans 8:28 and John 3:16
 * are not standalone presets, so they are plain references.
 */

export type MemorizeSuggestion =
  | {
      kind: "chapter";
      id: string;
      title: string;
      presetId: string;
      book: string;
      chapter: number;
      verseCount: number;
    }
  | {
      kind: "verses";
      id: string;
      title: string;
      /** Shown beside a title that is not a reference, e.g. "Matt 6:9–13". */
      detail?: string;
      span: VerseSpan;
    }
  | { kind: "collection"; id: string; title: string; presetId: string };

export const JOHN_3_16: VerseSpan = {
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
};

/** The first-run starter verse; first run leaves it out of the chips. */
export const STARTER_SUGGESTION_ID = "john-3-16";

function chapterSuggestion(presetId: string): MemorizeSuggestion {
  const preset = getMemoryPreset(presetId);
  if (preset?.kind !== "chapter" || preset.startChapter !== preset.endChapter) {
    throw new Error(`${presetId} is not a one-chapter preset`);
  }
  return {
    kind: "chapter",
    id: preset.id,
    title: preset.title,
    presetId: preset.id,
    book: preset.book,
    chapter: preset.startChapter,
    verseCount: chapterPresetVerseCount(preset),
  };
}

function collectionSuggestion(presetId: string): MemorizeSuggestion {
  const preset = getMemoryPreset(presetId);
  if (preset?.kind !== "collection") {
    throw new Error(`${presetId} is not a collection preset`);
  }
  return {
    kind: "collection",
    id: preset.id,
    title: preset.title,
    presetId: preset.id,
  };
}

export const MEMORIZE_SUGGESTIONS: readonly MemorizeSuggestion[] = [
  chapterSuggestion("psalm-23"),
  {
    kind: "verses",
    id: "lords-prayer",
    title: "The Lord's Prayer",
    detail: "Matt 6:9–13",
    span: { book: "Matthew", chapter: 6, startVerse: 9, endVerse: 13 },
  },
  {
    kind: "verses",
    id: "romans-8-28",
    title: "Romans 8:28",
    span: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 },
  },
  {
    kind: "verses",
    id: STARTER_SUGGESTION_ID,
    title: "John 3:16",
    span: JOHN_3_16,
  },
  chapterSuggestion("psalm-1"),
  chapterSuggestion("john-15"),
  chapterSuggestion("1-corinthians-13"),
  chapterSuggestion("philippians-4"),
  collectionSuggestion(HUNDRED_VERSES_PRESET_ID),
];

/** First run offers John 3:16 as its own starter, so the chips skip it. */
export function firstRunSuggestions(): MemorizeSuggestion[] {
  return MEMORIZE_SUGGESTIONS.filter(
    (suggestion) => suggestion.id !== STARTER_SUGGESTION_ID,
  );
}

/** What the Memorize sheet opens for a suggestion; `null` for a collection. */
export function suggestionTarget(
  suggestion: MemorizeSuggestion,
): MemorizeTarget | null {
  switch (suggestion.kind) {
    case "chapter":
      return {
        kind: "chapters",
        book: suggestion.book,
        startChapter: suggestion.chapter,
        endChapter: suggestion.chapter,
        presetId: suggestion.presetId,
        title: suggestion.title,
      };
    case "verses":
      return {
        kind: "spans",
        spans: [suggestion.span],
        title: suggestion.title,
      };
    case "collection":
      return null;
  }
}

/** A collection opens its page, where the user picks what to start. */
export function suggestionCollectionHref(presetId: string): string {
  return `/memory/presets/${encodeURIComponent(presetId)}`;
}
