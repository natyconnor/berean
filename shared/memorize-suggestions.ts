import type { VerseSpan } from "../src/lib/hearted-verse-coverage";
import {
  memorizeTargetSpans,
  resolveMemorizeTarget,
  type MemorizeTarget,
} from "../src/lib/memorize-target";
import {
  chapterPresetRange,
  chapterPresets,
  chapterPresetVerseCount,
  formatChapterRange,
  getMemoryPreset,
  HUNDRED_VERSES_PRESET_ID,
  type ChapterPreset,
} from "./memory-presets";

/**
 * Things to memorize offered on Today under "Start something new". Chapters
 * and The Lord's Prayer reuse `memory-presets.ts` ids. Romans 8:28 and John
 * 3:16 are not standalone presets, so they are plain references.
 */

export type MemorizeSuggestion =
  | {
      kind: "chapter";
      id: string;
      title: string;
      presetId: string;
      book: string;
      startChapter: number;
      endChapter: number;
      verseCount: number;
      /** Shown instead of the verse count when the title is a name. */
      detail?: string;
    }
  | {
      kind: "verses";
      id: string;
      title: string;
      /** Shown beside a title that is not a reference, e.g. "Matt 6:9–13". */
      detail?: string;
      span: VerseSpan;
      /** A passage preset these verses are, so its pack links back to it. */
      presetId?: string;
    }
  | { kind: "collection"; id: string; title: string; presetId: string };

export type MemorizableSuggestion = Exclude<
  MemorizeSuggestion,
  { kind: "collection" }
>;

export const JOHN_3_16: VerseSpan = {
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
};

/** The first-run starter verse; first run leaves it out of the chips. */
export const STARTER_SUGGESTION_ID = "john-3-16";

/** Suggestions Today shows before the collection chip. */
export const SUGGESTION_CHIP_COUNT = 8;

/**
 * A chapter preset as a suggestion: whole chapters, or one chapter's verses.
 * `null` for a range that crosses chapters.
 */
function presetSuggestion(preset: ChapterPreset): MemorizableSuggestion | null {
  const reference = formatChapterRange(preset);
  const detail = preset.title === reference ? undefined : reference;
  const range = chapterPresetRange(preset);
  if (!range) {
    return {
      kind: "chapter",
      id: preset.id,
      title: preset.title,
      presetId: preset.id,
      book: preset.book,
      startChapter: preset.startChapter,
      endChapter: preset.endChapter,
      verseCount: chapterPresetVerseCount(preset),
      ...(detail ? { detail } : {}),
    };
  }
  if (range.startChapter !== range.endChapter) return null;
  return {
    kind: "verses",
    id: preset.id,
    title: preset.title,
    ...(detail ? { detail } : {}),
    span: {
      book: range.book,
      chapter: range.startChapter,
      startVerse: range.startVerse,
      endVerse: range.endVerse,
    },
    presetId: preset.id,
  };
}

function chapterSuggestion(presetId: string): MemorizeSuggestion {
  const preset = getMemoryPreset(presetId);
  const suggestion =
    preset?.kind === "chapter" ? presetSuggestion(preset) : null;
  if (
    suggestion?.kind !== "chapter" ||
    suggestion.startChapter !== suggestion.endChapter
  ) {
    throw new Error(`${presetId} is not a one-chapter preset`);
  }
  return suggestion;
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
    presetId: "matthew-6-9-13",
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

function isMemorizable(
  suggestion: MemorizeSuggestion,
): suggestion is MemorizableSuggestion {
  return suggestion.kind !== "collection";
}

const CURATED = MEMORIZE_SUGGESTIONS.filter(isMemorizable);
const COLLECTIONS = MEMORIZE_SUGGESTIONS.filter(
  (suggestion) => !isMemorizable(suggestion),
);

/**
 * Everything Today may suggest, in order: the curated suggestions, then the
 * other chapter and passage presets in catalog order. Today skips the ones
 * already being memorized.
 */
export const MEMORIZE_SUGGESTION_POOL: readonly MemorizableSuggestion[] = [
  ...CURATED,
  ...chapterPresets()
    .filter(
      (preset) => !CURATED.some((curated) => curated.presetId === preset.id),
    )
    .flatMap((preset) => presetSuggestion(preset) ?? []),
];

/**
 * The first {@link SUGGESTION_CHIP_COUNT} pool suggestions not in `started`
 * (ids of ones already being memorized), then the collection. Nothing started
 * gives {@link MEMORIZE_SUGGESTIONS}.
 */
export function todaySuggestions(
  started: ReadonlySet<string>,
): MemorizeSuggestion[] {
  const fresh = MEMORIZE_SUGGESTION_POOL.filter(
    (suggestion) => !started.has(suggestion.id),
  ).slice(0, SUGGESTION_CHIP_COUNT);
  return [...fresh, ...COLLECTIONS];
}

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
        startChapter: suggestion.startChapter,
        endChapter: suggestion.endChapter,
        presetId: suggestion.presetId,
        title: suggestion.title,
      };
    case "verses":
      return {
        kind: "spans",
        spans: [suggestion.span],
        ...(suggestion.presetId ? { presetId: suggestion.presetId } : {}),
        title: suggestion.title,
      };
    case "collection":
      return null;
  }
}

/** The spans `verseMemory.memorizeStatus` checks for a suggestion. */
export function suggestionSpans(
  suggestion: MemorizableSuggestion,
): VerseSpan[] {
  const target = suggestionTarget(suggestion);
  return target ? memorizeTargetSpans(resolveMemorizeTarget(target)) : [];
}

/** A collection opens its page, where the user picks what to start. */
export function suggestionCollectionHref(presetId: string): string {
  return `/memory/presets/${encodeURIComponent(presetId)}`;
}
