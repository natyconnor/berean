import { spanContains, type VerseSpan } from "./hearted-verse-coverage";

/**
 * Pure helpers behind `verseMemory.memorizeStatus` and
 * `packs.createAndMemorize`. Convex imports this module, so it must only use
 * relative imports.
 */

/** Most spans one Memorize call may turn into a pack. */
export const MEMORIZE_MAX_PACK_SPANS = 200;

/**
 * How a passage relates to a target:
 * - `equal`: they cover the same verses (each target span sits inside the
 *   passage and each passage chapter span sits inside the target)
 * - `contains`: every target span sits inside the passage
 * - `null`: some of the target is outside the passage
 *
 * `passageSpans` is one span per chapter (see `passageHeartSpans`).
 */
export function passageCoverage(
  target: readonly VerseSpan[],
  passageSpans: readonly VerseSpan[],
): "equal" | "contains" | null {
  if (target.length === 0 || passageSpans.length === 0) return null;
  const inPassage = target.every((span) =>
    passageSpans.some((passage) => spanContains(passage, span)),
  );
  if (!inPassage) return null;
  const inTarget = passageSpans.every((passage) =>
    target.some((span) => spanContains(span, passage)),
  );
  return inTarget ? "equal" : "contains";
}

function spanKey(span: VerseSpan): string {
  return `${span.book}|${span.chapter}|${span.startVerse}|${span.endVerse}`;
}

/** Spans in first-seen order with exact repeats dropped. */
export function uniqueSpans(spans: readonly VerseSpan[]): VerseSpan[] {
  const seen = new Set<string>();
  const unique: VerseSpan[] = [];
  for (const span of spans) {
    const key = spanKey(span);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      book: span.book,
      chapter: span.chapter,
      startVerse: span.startVerse,
      endVerse: span.endVerse,
    });
  }
  return unique;
}

/** Same spans regardless of order or repeats. */
export function sameSpanSet(
  a: readonly VerseSpan[],
  b: readonly VerseSpan[],
): boolean {
  const left = new Set(a.map(spanKey));
  const right = new Set(b.map(spanKey));
  if (left.size !== right.size) return false;
  for (const key of left) {
    if (!right.has(key)) return false;
  }
  return true;
}
