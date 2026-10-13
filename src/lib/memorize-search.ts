import { chapterPresets } from "../../shared/memory-presets";
import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";
import { BIBLE_BOOKS } from "./bible-books";
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
  formatVerseRef,
  isChapterScopeRef,
  parseVerseRef,
  type VerseRef,
} from "./verse-ref-utils";

/**
 * Today's "What do you want to memorize?" search: a typed reference becomes
 * one Memorize target with its plan line, and the same text filters "From
 * your hearts". Pure.
 */

export type MemorizeSearchResult =
  | { kind: "empty" }
  | { kind: "noMatch" }
  | {
      kind: "match";
      target: MemorizeTarget;
      title: string;
      /** "6 verses · learn it in about 4 days" */
      planLine: string;
    };

const ABBREVIATIONS = new Map(
  BIBLE_BOOKS.map((book) => [book.name, book.abbreviation]),
);

function parseSearchRef(text: string): VerseRef | null {
  const normalized = text.trim().replace(/[–—]/g, "-");
  if (normalized.length === 0) return null;
  return parseVerseRef(normalized, { allowChapterOnly: true });
}

function chapterTarget(book: string, chapter: number): MemorizeTarget {
  const preset = chapterPresets().find(
    (candidate) =>
      candidate.book === book &&
      candidate.startChapter === chapter &&
      candidate.endChapter === chapter,
  );
  return {
    kind: "chapters",
    book,
    startChapter: chapter,
    endChapter: chapter,
    ...(preset ? { presetId: preset.id, title: preset.title } : {}),
  };
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
  const ref = parseSearchRef(text);
  if (!ref) return { kind: "noMatch" };

  const target = isChapterScopeRef(ref)
    ? chapterTarget(ref.book, ref.chapter)
    : ({
        kind: "spans",
        spans: [
          {
            book: ref.book,
            chapter: ref.chapter,
            startVerse: ref.startVerse,
            endVerse: ref.endVerse,
          },
        ],
      } satisfies MemorizeTarget);
  const resolved = resolveMemorizeTarget(target, deps);
  if (resolved.mode === "invalid") return { kind: "noMatch" };
  return {
    kind: "match",
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

/**
 * Whether a heart belongs under the search text: inside a typed reference
 * ("Psalm 23", "Romans 8:28–30"), else a book or reference that contains the
 * text ("Rom", "Romans 8"). Empty text matches everything.
 */
export function heartMatchesSearch(heart: VerseSpan, text: string): boolean {
  const query = text.trim();
  if (query.length === 0) return true;

  const ref = parseSearchRef(query);
  if (ref) {
    if (ref.book !== heart.book || ref.chapter !== heart.chapter) return false;
    if (isChapterScopeRef(ref)) return true;
    return heart.startVerse <= ref.endVerse && heart.endVerse >= ref.startVerse;
  }

  return (
    heartMatchesBookFilter(heart.book, query, ABBREVIATIONS.get(heart.book)) ||
    formatVerseRef(heart).toLowerCase().includes(query.toLowerCase())
  );
}
