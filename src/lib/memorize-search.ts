import {
  chapterPresetRange,
  chapterPresets,
} from "../../shared/memory-presets";
import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";
import { BIBLE_BOOKS, getBookInfo } from "./bible-books";
import { getChapterVerseCount } from "./bible-verse-counts";
import { heartMatchesBookFilter } from "./heart-list";
import type { VerseSpan } from "./hearted-verse-coverage";
import { estimateMemorizeDays, formatLearnDuration } from "./memorize-plan";
import {
  resolveMemorizeTarget,
  type MemorizeTarget,
  type MemorizeTargetDeps,
  type ResolvedMemorize,
} from "./memorize-target";
import {
  formatPassageRange,
  rangeChapterSpans,
  type ChapterVerseCount,
  type PassageRange,
} from "./passage-range";
import {
  formatVerseRef,
  isChapterScopeRef,
  parseVerseRef,
  resolveCanonicalBookName,
  type VerseRef,
} from "./verse-ref-utils";

/**
 * Today's "What do you want to memorize?" search: a typed reference (a
 * verse, a range, a chapter, chapters, or a range across chapters) becomes
 * one Memorize target with its plan line, and the same text filters "From
 * your hearts". Pure.
 */

export type MemorizeSearchResult =
  | { kind: "empty" }
  | { kind: "noMatch" }
  | ({ kind: "match" } & MemorizeSearchMatch & {
        /**
         * The other reading of an ambiguous "John 3-16": chapters 3–16 or
         * verse 3:16. Offered as "Did you mean …?" under the match.
         */
        alternate?: MemorizeSearchMatch;
      });

export type MemorizeSearchMatch = {
  target: MemorizeTarget;
  title: string;
  /** "6 verses · learn it in about 4 days" */
  planLine: string;
};

const ABBREVIATIONS = new Map(
  BIBLE_BOOKS.map((book) => [book.name, book.abbreviation]),
);

function normalizeSearchText(text: string): string {
  return text.trim().replace(/[–—]/g, "-");
}

function parseSearchRef(text: string): VerseRef | null {
  const normalized = normalizeSearchText(text);
  if (normalized.length === 0) return null;
  return parseVerseRef(normalized, { allowChapterOnly: true });
}

/** What the Memorize search reads: whole chapters, or a run of verses. */
type SearchPassage =
  | { kind: "chapters"; book: string; startChapter: number; endChapter: number }
  | { kind: "verses"; range: PassageRange };

const CHAPTER_RANGE = /^(.+?)\s+(\d+)\s*-\s*(\d+)$/;
const CROSS_CHAPTER_RANGE = /^(.+?)\s+(\d+):(\d+)\s*-\s*(\d+):(\d+)$/;

function chaptersHavePreset(
  book: string,
  startChapter: number,
  endChapter: number,
): boolean {
  return chapterPresets().some(
    (preset) =>
      preset.book === book &&
      preset.startChapter === startChapter &&
      preset.endChapter === endChapter &&
      chapterPresetRange(preset) === null,
  );
}

/**
 * Every reading of the search text, most likely first. "Book A-B" is
 * ambiguous when chapter A has a verse B: it is read as verse A:B unless a
 * suggested passage covers chapters A–B ("Matthew 5-7").
 */
function parseSearchPassages(
  text: string,
  chapterVerseCount: ChapterVerseCount,
): SearchPassage[] {
  const primary = parseSearchPassage(text, chapterVerseCount);
  if (!primary || primary.kind !== "chapters") return primary ? [primary] : [];
  if (primary.startChapter === primary.endChapter) return [primary];

  const verses = chapterVerseCount(primary.book, primary.startChapter);
  if (verses === null || primary.endChapter > verses) return [primary];
  const verse: SearchPassage = {
    kind: "verses",
    range: {
      book: primary.book,
      startChapter: primary.startChapter,
      startVerse: primary.endChapter,
      endChapter: primary.startChapter,
      endVerse: primary.endChapter,
    },
  };
  return chaptersHavePreset(
    primary.book,
    primary.startChapter,
    primary.endChapter,
  )
    ? [primary, verse]
    : [verse, primary];
}

/**
 * "Psalm 23", "Matthew 5–7", "Romans 8:28–30", "Romans 7:24–8:2". Chapters
 * must exist in the book and verses in their chapters; `null` otherwise.
 */
function parseSearchPassage(
  text: string,
  chapterVerseCount: ChapterVerseCount,
): SearchPassage | null {
  const normalized = normalizeSearchText(text);
  if (normalized.length === 0) return null;

  const crossChapter = normalized.match(CROSS_CHAPTER_RANGE);
  if (crossChapter) {
    const book = resolveCanonicalBookName(crossChapter[1]);
    if (!book) return null;
    const [startChapter, startVerse, endChapter, endVerse] = crossChapter
      .slice(2)
      .map((part) => Number.parseInt(part, 10));
    const range = { book, startChapter, startVerse, endChapter, endVerse };
    return rangeChapterSpans(range, chapterVerseCount)
      ? { kind: "verses", range }
      : null;
  }

  const chapterRange = normalized.match(CHAPTER_RANGE);
  if (chapterRange) {
    const book = resolveCanonicalBookName(chapterRange[1]);
    const chapters = book ? getBookInfo(book)?.chapters : undefined;
    const startChapter = Number.parseInt(chapterRange[2], 10);
    const endChapter = Number.parseInt(chapterRange[3], 10);
    if (
      book &&
      chapters !== undefined &&
      startChapter >= 1 &&
      endChapter >= startChapter &&
      endChapter <= chapters
    ) {
      return { kind: "chapters", book, startChapter, endChapter };
    }
  }

  const ref = parseVerseRef(normalized, { allowChapterOnly: true });
  if (!ref) return null;
  if (isChapterScopeRef(ref)) {
    return {
      kind: "chapters",
      book: ref.book,
      startChapter: ref.chapter,
      endChapter: ref.chapter,
    };
  }
  return {
    kind: "verses",
    range: {
      book: ref.book,
      startChapter: ref.chapter,
      startVerse: ref.startVerse,
      endChapter: ref.chapter,
      endVerse: ref.endVerse,
    },
  };
}

/** Whole chapters, named after their preset when one covers exactly them. */
function chapterTarget(
  book: string,
  startChapter: number,
  endChapter: number,
): MemorizeTarget {
  const preset = chapterPresets().find(
    (candidate) =>
      candidate.book === book &&
      candidate.startChapter === startChapter &&
      candidate.endChapter === endChapter &&
      chapterPresetRange(candidate) === null,
  );
  return {
    kind: "chapters",
    book,
    startChapter,
    endChapter,
    ...(preset ? { presetId: preset.id, title: preset.title } : {}),
  };
}

function versesTarget(
  range: PassageRange,
  chapterVerseCount: ChapterVerseCount,
): MemorizeTarget {
  const spans = rangeChapterSpans(range, chapterVerseCount) ?? [];
  return range.startChapter === range.endChapter
    ? { kind: "spans", spans }
    : { kind: "spans", spans, title: formatPassageRange(range) };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** How long the learning steps take; mastery is a separate fact on the sheet. */
export function memorizePlanLine(
  resolved: Exclude<ResolvedMemorize, { mode: "invalid" }>,
): string {
  const cards =
    resolved.mode === "pack" ? resolved.spans.length : resolved.verseCount;
  const learn = formatLearnDuration(
    estimateMemorizeDays({ mode: resolved.mode, verseCount: cards }),
  );
  if (resolved.verseCount <= 1) return learn;
  return `${plural(resolved.verseCount, "verse")} · ${learn.charAt(0).toLowerCase()}${learn.slice(1)}`;
}

export function memorizeSearch(
  text: string,
  deps?: MemorizeTargetDeps,
): MemorizeSearchResult {
  if (text.trim().length === 0) return { kind: "empty" };
  const chapterVerseCount = deps?.chapterVerseCount ?? getChapterVerseCount;
  const [match, alternate] = parseSearchPassages(text, chapterVerseCount)
    .map((passage) => searchMatch(passage, chapterVerseCount, deps))
    .filter((candidate) => candidate !== null);
  if (!match) return { kind: "noMatch" };
  return alternate
    ? { kind: "match", ...match, alternate }
    : { kind: "match", ...match };
}

function searchMatch(
  passage: SearchPassage,
  chapterVerseCount: ChapterVerseCount,
  deps: MemorizeTargetDeps | undefined,
): MemorizeSearchMatch | null {
  const target =
    passage.kind === "chapters"
      ? chapterTarget(passage.book, passage.startChapter, passage.endChapter)
      : versesTarget(passage.range, chapterVerseCount);
  const resolved = resolveMemorizeTarget(target, deps);
  if (resolved.mode === "invalid") return null;
  return {
    target,
    title: resolved.title,
    planLine: memorizePlanLine(resolved),
  };
}

export type ReferenceSpanResult =
  | { kind: "empty" }
  | { kind: "noMatch" }
  | { kind: "outOfRange"; message: string }
  | { kind: "match"; span: VerseSpan };

/**
 * A typed reference as one span, for adding verses to a pack: "John 14:27",
 * "Romans 8:28–30", or a whole chapter ("Psalm 23"). References only; there
 * is no word search.
 */
export function parseReferenceSpan(text: string): ReferenceSpanResult {
  if (text.trim().length === 0) return { kind: "empty" };
  const ref = parseSearchRef(text);
  if (!ref) return { kind: "noMatch" };
  const message = getVerseRefBoundsErrorMessage(ref);
  if (message) return { kind: "outOfRange", message };

  if (isChapterScopeRef(ref)) {
    const verses = getChapterVerseCount(ref.book, ref.chapter);
    if (!verses) return { kind: "noMatch" };
    return {
      kind: "match",
      span: {
        book: ref.book,
        chapter: ref.chapter,
        startVerse: 1,
        endVerse: verses,
      },
    };
  }
  return {
    kind: "match",
    span: {
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    },
  };
}

function passageSharesVerses(
  passage: SearchPassage,
  heart: VerseSpan,
): boolean {
  if (passage.kind === "chapters") {
    return (
      heart.book === passage.book &&
      heart.chapter >= passage.startChapter &&
      heart.chapter <= passage.endChapter
    );
  }
  const { range } = passage;
  if (
    heart.book !== range.book ||
    heart.chapter < range.startChapter ||
    heart.chapter > range.endChapter
  ) {
    return false;
  }
  const first = heart.chapter === range.startChapter ? range.startVerse : 1;
  const last =
    heart.chapter === range.endChapter
      ? range.endVerse
      : Number.POSITIVE_INFINITY;
  return heart.startVerse <= last && heart.endVerse >= first;
}

/**
 * Whether a heart belongs under the search text: inside a typed reference
 * ("Psalm 23", "Matthew 5–7", "Romans 8:28–30"), else a book or reference
 * that contains the text ("Rom", "Romans 8"). Empty text matches everything.
 */
export function heartMatchesSearch(heart: VerseSpan, text: string): boolean {
  const query = text.trim();
  if (query.length === 0) return true;

  const passages = parseSearchPassages(query, getChapterVerseCount);
  if (passages.length > 0) {
    return passages.some((passage) => passageSharesVerses(passage, heart));
  }

  return (
    heartMatchesBookFilter(heart.book, query, ABBREVIATIONS.get(heart.book)) ||
    formatVerseRef(heart).toLowerCase().includes(query.toLowerCase())
  );
}
