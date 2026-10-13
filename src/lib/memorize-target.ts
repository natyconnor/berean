import { getChapterVerseCount } from "./bible-verse-counts";
import type { VerseSpan } from "./hearted-verse-coverage";
import { MEMORIZE_MAX_PACK_SPANS, uniqueSpans } from "./memorize-status";
import {
  MIN_PASSAGE_VERSES,
  packAllowsPassageMode,
  rangeAllowsPassageMode,
} from "./passage-eligibility";
import {
  contiguousRange,
  formatPassageRange,
  rangeChapterSpans,
  rangeVerseCount,
  type ChapterVerseCount,
  type PassageRange,
} from "./passage-range";
import { AUTO_HEART_MAX_CHAPTERS } from "./scope-chapter-count";
import type { FullScope } from "./scope-equality";
import { formatBookChapter, formatVerseRef } from "./verse-ref-utils";
import { getMemoryPreset } from "../../shared/memory-presets";

export type { PassageRange } from "./passage-range";

/**
 * What a Memorize entry point asks for. The resolver decides how it is
 * memorized; the user never picks a method. `presetId` links a passage to
 * the catalog entry it came from.
 */
export type MemorizeTarget =
  | { kind: "spans"; spans: VerseSpan[]; presetId?: string; title?: string }
  | {
      kind: "chapters";
      book: string;
      startChapter: number;
      endChapter: number;
      presetId?: string;
      title?: string;
    };

export type ResolvedMemorize =
  | { mode: "verse"; title: string; span: VerseSpan; verseCount: number }
  | {
      mode: "passage";
      title: string;
      book: string;
      startChapter: number;
      endChapter: number;
      /** Verse bounds when it starts or ends mid-chapter; `null` = whole chapters. */
      range: PassageRange | null;
      presetId?: string;
      verseCount: number;
    }
  | { mode: "pack"; title: string; spans: VerseSpan[]; verseCount: number }
  | {
      mode: "invalid";
      title: string;
      reason: "tooLong" | "empty" | "crossBook";
    };

export type MemorizeTargetDeps = {
  chapterVerseCount: ChapterVerseCount;
};

/** Most verses that still become one verse card. */
export const MAX_VERSE_CARD_VERSES = MIN_PASSAGE_VERSES - 1;

const DEFAULT_DEPS: MemorizeTargetDeps = {
  chapterVerseCount: getChapterVerseCount,
};

const EN_DASH = "\u2013";

/** "Psalm 1", "Matthew 5–7". */
export function formatChapterSpanTitle(
  book: string,
  startChapter: number,
  endChapter: number,
): string {
  const first = formatBookChapter(book, startChapter);
  return startChapter === endChapter
    ? first
    : `${first}${EN_DASH}${endChapter}`;
}

/** "Romans 8:28", "Philippians 2:1–11". */
export function formatSpanTitle(span: VerseSpan): string {
  if (span.startVerse === span.endVerse) return formatVerseRef(span);
  return `${formatBookChapter(span.book, span.chapter)}:${span.startVerse}${EN_DASH}${span.endVerse}`;
}

/** "Psalm 23" when the span is the whole chapter, else {@link formatSpanTitle}. */
export function spanDisplayTitle(
  span: VerseSpan,
  deps: MemorizeTargetDeps = DEFAULT_DEPS,
): string {
  const verses = deps.chapterVerseCount(span.book, span.chapter);
  if (span.startVerse === 1 && verses !== null && span.endVerse === verses) {
    return formatBookChapter(span.book, span.chapter);
  }
  return formatSpanTitle(span);
}

/**
 * The scope pack a passage is stored as: its covering chapters. A
 * partial-chapter passage also stores its `passageRange`.
 */
export function passageScope(
  book: string,
  startChapter: number,
  endChapter: number,
): FullScope {
  return {
    books: [book],
    chapterRanges: [{ book, startChapter, endChapter }],
    tags: [],
    tagMatchMode: "any",
  };
}

function spanVerseCount(span: VerseSpan): number {
  return span.endVerse - span.startVerse + 1;
}

function isWholeNumber(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min;
}

function isValidSpan(span: VerseSpan, deps: MemorizeTargetDeps): boolean {
  if (!isWholeNumber(span.chapter, 1)) return false;
  if (!isWholeNumber(span.startVerse, 1)) return false;
  if (!Number.isInteger(span.endVerse) || span.endVerse < span.startVerse) {
    return false;
  }
  const verses = deps.chapterVerseCount(span.book, span.chapter);
  return verses !== null && span.endVerse <= verses;
}

/**
 * The chapters the spans cover exactly (every verse of each, nothing else), in
 * first-seen order, or `null` when any chapter is only partly covered.
 */
function wholeChaptersCovered(
  spans: readonly VerseSpan[],
  deps: MemorizeTargetDeps,
): { book: string; chapter: number }[] | null {
  const covered = new Map<
    string,
    { book: string; chapter: number; verses: Set<number> }
  >();
  for (const span of spans) {
    const key = `${span.book}|${span.chapter}`;
    let entry = covered.get(key);
    if (!entry) {
      entry = { book: span.book, chapter: span.chapter, verses: new Set() };
      covered.set(key, entry);
    }
    for (let verse = span.startVerse; verse <= span.endVerse; verse += 1) {
      entry.verses.add(verse);
    }
  }

  const chapters: { book: string; chapter: number }[] = [];
  for (const { book, chapter, verses } of covered.values()) {
    const total = deps.chapterVerseCount(book, chapter);
    if (total === null || verses.size !== total) return null;
    chapters.push({ book, chapter });
  }
  return chapters;
}

function resolveChapters(
  target: {
    book: string;
    startChapter: number;
    endChapter: number;
    presetId?: string;
    title?: string;
  },
  deps: MemorizeTargetDeps,
): ResolvedMemorize {
  const { book, startChapter, endChapter, presetId } = target;
  const preset = presetId ? getMemoryPreset(presetId) : undefined;
  const title =
    target.title ??
    (preset?.kind === "chapter" ? preset.title : undefined) ??
    formatChapterSpanTitle(book, startChapter, endChapter);

  if (
    !isWholeNumber(startChapter, 1) ||
    !isWholeNumber(endChapter, startChapter)
  ) {
    return { mode: "invalid", title, reason: "empty" };
  }
  if (endChapter - startChapter + 1 > AUTO_HEART_MAX_CHAPTERS) {
    return { mode: "invalid", title, reason: "tooLong" };
  }

  let verseCount = 0;
  for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
    const verses = deps.chapterVerseCount(book, chapter);
    if (verses === null) return { mode: "invalid", title, reason: "empty" };
    verseCount += verses;
  }
  if (!packAllowsPassageMode(passageScope(book, startChapter, endChapter))) {
    return { mode: "invalid", title, reason: "empty" };
  }
  if (startChapter === endChapter && verseCount < MIN_PASSAGE_VERSES) {
    return {
      mode: "verse",
      title,
      span: {
        book,
        chapter: startChapter,
        startVerse: 1,
        endVerse: verseCount,
      },
      verseCount,
    };
  }

  return {
    mode: "passage",
    title,
    book,
    startChapter,
    endChapter,
    range: null,
    ...(presetId ? { presetId } : {}),
    verseCount,
  };
}

/** A contiguous partial-chapter run of {@link MIN_PASSAGE_VERSES}+ verses. */
function resolveRange(
  range: PassageRange,
  target: { presetId?: string; title?: string },
  deps: MemorizeTargetDeps,
): ResolvedMemorize {
  const preset = target.presetId ? getMemoryPreset(target.presetId) : undefined;
  const title =
    target.title ??
    (preset?.kind === "chapter" ? preset.title : undefined) ??
    formatPassageRange(range);
  if (!rangeAllowsPassageMode(range, deps.chapterVerseCount)) {
    return { mode: "invalid", title, reason: "tooLong" };
  }
  return {
    mode: "passage",
    title,
    book: range.book,
    startChapter: range.startChapter,
    endChapter: range.endChapter,
    range,
    ...(target.presetId ? { presetId: target.presetId } : {}),
    verseCount: rangeVerseCount(range, deps.chapterVerseCount) ?? 0,
  };
}

function resolveSpans(
  target: { spans: VerseSpan[]; presetId?: string; title?: string },
  deps: MemorizeTargetDeps,
): ResolvedMemorize {
  const spans = uniqueSpans(target.spans);
  const first = spans[0];
  if (!first || !spans.every((span) => isValidSpan(span, deps))) {
    return { mode: "invalid", title: target.title ?? "", reason: "empty" };
  }

  const chapters = wholeChaptersCovered(spans, deps);
  if (chapters) {
    if (new Set(chapters.map(({ book }) => book)).size > 1) {
      return {
        mode: "invalid",
        title:
          target.title ??
          chapters
            .map(({ book, chapter }) => formatBookChapter(book, chapter))
            .join(", "),
        reason: "crossBook",
      };
    }
    const numbers = chapters.map(({ chapter }) => chapter);
    const startChapter = Math.min(...numbers);
    const endChapter = Math.max(...numbers);
    if (endChapter - startChapter + 1 === chapters.length) {
      return resolveChapters(
        {
          book: first.book,
          startChapter,
          endChapter,
          presetId: target.presetId,
          title: target.title,
        },
        deps,
      );
    }
  }

  const range = contiguousRange(spans, deps.chapterVerseCount);
  const rangeVerses = range
    ? (rangeVerseCount(range, deps.chapterVerseCount) ?? 0)
    : 0;
  if (range && rangeVerses >= MIN_PASSAGE_VERSES) {
    return resolveRange(range, target, deps);
  }

  if (spans.length === 1) {
    const verseCount = spanVerseCount(first);
    return {
      mode: "verse",
      title: target.title ?? formatSpanTitle(first),
      span: first,
      verseCount,
    };
  }

  const verseCount = spans.reduce((sum, span) => sum + spanVerseCount(span), 0);
  const title = target.title ?? `${verseCount} verses`;
  if (spans.length > MEMORIZE_MAX_PACK_SPANS) {
    return { mode: "invalid", title, reason: "tooLong" };
  }
  return { mode: "pack", title, spans, verseCount };
}

/**
 * The spans a resolved target memorizes, for `verseMemory.memorizeStatus`:
 * the verse, the pack's spans, or one span per passage chapter (trimmed to
 * the passage's range). Empty for an invalid target.
 */
export function memorizeTargetSpans(
  resolved: ResolvedMemorize,
  deps: MemorizeTargetDeps = DEFAULT_DEPS,
): VerseSpan[] {
  switch (resolved.mode) {
    case "verse":
      return [resolved.span];
    case "pack":
      return resolved.spans;
    case "invalid":
      return [];
    case "passage": {
      const range: PassageRange = resolved.range ?? {
        book: resolved.book,
        startChapter: resolved.startChapter,
        startVerse: 1,
        endChapter: resolved.endChapter,
        endVerse:
          deps.chapterVerseCount(resolved.book, resolved.endChapter) ?? 0,
      };
      return rangeChapterSpans(range, deps.chapterVerseCount) ?? [];
    }
  }
}

/**
 * Decide how a target is memorized (Decisions → One verb, automatic mode):
 * - one contiguous run in one book (it may cross chapters, whole chapters
 *   included) of {@link MIN_PASSAGE_VERSES}+ verses → passage, up to
 *   {@link AUTO_HEART_MAX_CHAPTERS} chapters; more is `tooLong`. A run that
 *   groups into a single learning piece is still one verse card; that needs
 *   verse text, so the start path decides it (`planPassagePieces`).
 * - one span of 1–{@link MAX_VERSE_CARD_VERSES} verses (Psalm 117 too) → one
 *   verse card
 * - several separate spans → a pack, one card per span
 * - whole chapters in more than one book → `crossBook` (a passage stays in
 *   one book)
 * - nothing valid to memorize → `empty`
 */
export function resolveMemorizeTarget(
  target: MemorizeTarget,
  deps: MemorizeTargetDeps = DEFAULT_DEPS,
): ResolvedMemorize {
  return target.kind === "chapters"
    ? resolveChapters(target, deps)
    : resolveSpans(target, deps);
}
