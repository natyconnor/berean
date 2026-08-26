import { getChapterVerseCount } from "./bible-verse-counts";
import type { VerseSpan } from "./hearted-verse-coverage";
import { enumerateScopeChapters } from "./scope-chapter-count";
import { scopeCoverageComplete } from "./scope-verse-coverage";
import type { VerseScope } from "./verse-scope-match";

function coverKey(chapter: number, verse: number): string {
  return `${chapter}:${verse}`;
}

/**
 * True when the spans are one block of consecutive verses in a single book.
 * Chapter boundaries count: the last verse of chapter N sits next to verse 1
 * of chapter N+1. Gaps, skipped chapters, or a second book fail.
 */
export function spansFormContiguousBlock(spans: readonly VerseSpan[]): boolean {
  if (spans.length === 0) return false;
  const book = spans[0]?.book;
  if (!book) return false;
  if (spans.some((span) => span.book !== book)) return false;

  const covered = new Set<string>();
  let minChapter = Infinity;
  let maxChapter = 0;
  for (const span of spans) {
    const verseCount = getChapterVerseCount(book, span.chapter);
    if (verseCount == null) return false;
    const start = Math.max(1, span.startVerse);
    const end = Math.min(verseCount, span.endVerse);
    if (start > end) return false;
    minChapter = Math.min(minChapter, span.chapter);
    maxChapter = Math.max(maxChapter, span.chapter);
    for (let verse = start; verse <= end; verse += 1) {
      covered.add(coverKey(span.chapter, verse));
    }
  }

  const firstCount = getChapterVerseCount(book, minChapter);
  if (firstCount == null) return false;
  let chapter = minChapter;
  let verse = 1;
  while (!covered.has(coverKey(chapter, verse))) {
    verse += 1;
    if (verse > firstCount) return false;
  }

  let seen = 0;
  const total = covered.size;
  while (seen < total) {
    if (!covered.has(coverKey(chapter, verse))) return false;
    seen += 1;
    const verseCount = getChapterVerseCount(book, chapter);
    if (verseCount == null) return false;
    if (verse < verseCount) {
      verse += 1;
      continue;
    }
    chapter += 1;
    verse = 1;
    if (seen < total && chapter > maxChapter) return false;
  }
  return true;
}

/** Scope chapters sit in one book with no skipped chapter numbers. */
export function scopeChaptersAreContiguous(scope: VerseScope): boolean {
  const chapters = enumerateScopeChapters(scope);
  if (chapters.length === 0) return false;
  const book = chapters[0]?.book;
  if (!book) return false;
  if (chapters.some((entry) => entry.book !== book)) return false;
  const sorted = chapters.map((entry) => entry.chapter).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous === undefined || current === undefined) return false;
    if (current !== previous + 1) return false;
  }
  return true;
}

/**
 * Recite-as-one-passage only makes sense for a single block of verses, or for
 * a scope that is itself a contiguous range and fully hearted.
 */
export function packAllowsUnifiedRecitation(
  spans: readonly VerseSpan[],
  scope?: VerseScope,
): boolean {
  if (spansFormContiguousBlock(spans)) return true;
  return (
    scope !== undefined &&
    scopeChaptersAreContiguous(scope) &&
    scopeCoverageComplete(scope, spans)
  );
}
