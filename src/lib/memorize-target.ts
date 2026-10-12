import { getChapterVerseCount } from "./bible-verse-counts";
import type { VerseSpan } from "./hearted-verse-coverage";
import { MEMORIZE_MAX_PACK_SPANS, uniqueSpans } from "./memorize-status";
import { packAllowsPassageMode } from "./passage-eligibility";
import { AUTO_HEART_MAX_CHAPTERS } from "./scope-chapter-count";
import type { FullScope } from "./scope-equality";
import { formatBookChapter, formatVerseRef } from "./verse-ref-utils";
import { getMemoryPreset } from "../../shared/memory-presets";

/**
 * What a Memorize entry point asks for. The resolver decides how it is
 * memorized; the user never picks a method.
 */
export type MemorizeTarget =
  | { kind: "spans"; spans: VerseSpan[]; title?: string }
  | {
      kind: "chapters";
      book: string;
      startChapter: number;
      endChapter: number;
      presetId?: string;
      title?: string;
    };

/** A passage that starts or ends mid-chapter. Always `null` until PR 18. */
export type PassageRange = {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
};

export type ResolvedMemorize =
  | { mode: "verse"; title: string; span: VerseSpan; verseCount: number }
  | {
      mode: "passage";
      title: string;
      book: string;
      startChapter: number;
      endChapter: number;
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
  chapterVerseCount(book: string, chapter: number): number | null;
};

/** Most verses that still become one verse card. */
export const MAX_VERSE_CARD_VERSES = 3;

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

/** The scope pack a chapter passage is stored as. */
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

function resolveSpans(
  target: { spans: VerseSpan[]; title?: string },
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
        { book: first.book, startChapter, endChapter, title: target.title },
        deps,
      );
    }
  }

  if (spans.length === 1) {
    const verseCount = spanVerseCount(first);
    const title = target.title ?? formatSpanTitle(first);
    if (verseCount <= MAX_VERSE_CARD_VERSES) {
      return { mode: "verse", title, span: first, verseCount };
    }
    const verses: VerseSpan[] = [];
    for (let verse = first.startVerse; verse <= first.endVerse; verse += 1) {
      verses.push({
        book: first.book,
        chapter: first.chapter,
        startVerse: verse,
        endVerse: verse,
      });
    }
    return { mode: "pack", title, spans: verses, verseCount };
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
 * the verse, the pack's spans, or each passage chapter as a whole-chapter
 * span. Empty for an invalid target.
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
      const spans: VerseSpan[] = [];
      for (
        let chapter = resolved.startChapter;
        chapter <= resolved.endChapter;
        chapter += 1
      ) {
        const verses = deps.chapterVerseCount(resolved.book, chapter);
        if (verses === null) return [];
        spans.push({
          book: resolved.book,
          chapter,
          startVerse: 1,
          endVerse: verses,
        });
      }
      return spans;
    }
  }
}

/**
 * Decide how a target is memorized (rules before PR 18):
 * - whole contiguous chapters in one book (a `chapters` target, or spans that
 *   cover exactly those chapters) → passage, up to
 *   {@link AUTO_HEART_MAX_CHAPTERS} chapters; more is `tooLong`
 * - one span of 1–{@link MAX_VERSE_CARD_VERSES} verses → one verse card
 * - one partial-chapter span of more verses → a pack of one card per verse
 * - several spans → a pack, one card per span
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
