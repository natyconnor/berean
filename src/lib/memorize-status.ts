import {
  spanContains,
  spansOverlap,
  type VerseSpan,
} from "./hearted-verse-coverage";
import { isReviewPhase, type MemoryStatus } from "./memory-scheduler";

/**
 * Pure helpers behind `verseMemory.memorizeStatus` and
 * `packs.createAndMemorize`. Convex imports this module, so it must only use
 * relative imports.
 */

/** Most spans one Memorize call may turn into a pack. */
export const MEMORIZE_MAX_PACK_SPANS = 200;

/** Most targets one `verseMemory.memorizeStatuses` call checks. */
export const MEMORIZE_STATUS_MAX_TARGETS = 40;

/** Longest pack name `packs.createAndMemorize` and `packs.rename` accept. */
export const MAX_PACK_NAME_LENGTH = 80;

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

/** Whether any span in `a` shares a verse with any span in `b`. */
export function spansOverlapAny(
  a: readonly VerseSpan[],
  b: readonly VerseSpan[],
): boolean {
  return a.some((left) => b.some((right) => spansOverlap(left, right)));
}

/**
 * `passageCoverage`, plus `overlaps` when the target is not inside the
 * passage but shares verses with it (it contains the passage or crosses one
 * of its edges).
 */
export function passageRelation(
  target: readonly VerseSpan[],
  passageSpans: readonly VerseSpan[],
): "equal" | "contains" | "overlaps" | null {
  const coverage = passageCoverage(target, passageSpans);
  if (coverage) return coverage;
  return spansOverlapAny(target, passageSpans) ? "overlaps" : null;
}

/** Identity of an exact span ("John|14|27|27"). */
export function spanKey(span: VerseSpan): string {
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

/** A verse in Memory on its own, with the progress a passage start reads. */
export type VerseProgressSpan = VerseSpan & {
  status: MemoryStatus;
  learnStage: number;
  stageReps: number;
};

/** A verse whose progress a new passage over it would keep. */
export type CarriedOverVerse = VerseSpan & { memorized: boolean };

/**
 * Verses in Memory that sit fully inside `target` and whose progress a new
 * passage would keep (as `inferPieceLearningState` reads it): memorized ones
 * count as learned, started ones resume. Up next and never-practiced verses
 * carry nothing. In Scripture order, exact repeats dropped.
 */
export function carriedOverVerses(
  target: readonly VerseSpan[],
  verses: readonly VerseProgressSpan[],
): CarriedOverVerse[] {
  const seen = new Set<string>();
  const carried: CarriedOverVerse[] = [];
  for (const verse of verses) {
    const memorized = isReviewPhase(verse.status);
    const started =
      verse.status === "learning" &&
      (verse.learnStage > 0 || verse.stageReps > 0);
    if (!memorized && !started) continue;
    if (!target.some((span) => spanContains(span, verse))) continue;
    const key = spanKey(verse);
    if (seen.has(key)) continue;
    seen.add(key);
    carried.push({
      book: verse.book,
      chapter: verse.chapter,
      startVerse: verse.startVerse,
      endVerse: verse.endVerse,
      memorized,
    });
  }
  return carried.sort(
    (a, b) =>
      a.chapter - b.chapter ||
      a.startVerse - b.startVerse ||
      a.endVerse - b.endVerse,
  );
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
