import type { DiffToken } from "@/lib/diff-words";
import { REVIEW_LAPSE_ACCURACY } from "@/lib/memory-scheduler";

/**
 * How close the user's typed verse came to the actual text.
 *
 * - `exact`: every diff token matched (ignoring case and trailing punctuation).
 * - `close`: imperfect, but accuracy at or above {@link REVIEW_LAPSE_ACCURACY}.
 * - `off`: accuracy below {@link REVIEW_LAPSE_ACCURACY}.
 */
export type VerseAttemptQuality = "exact" | "close" | "off";

/** Errors we count when scoring a typed attempt. */
const ERROR_STATUSES: ReadonlySet<DiffToken["status"]> = new Set([
  "mismatch",
  "missing",
  "extra",
]);

export function verseAttemptAccuracy(tokens: ReadonlyArray<DiffToken>): number {
  if (tokens.length === 0) return 0;

  let matches = 0;
  for (const token of tokens) {
    if (token.status === "match") matches += 1;
  }
  return Math.round((matches / tokens.length) * 100);
}

/**
 * Classify a typed verse-memory attempt based on its diff tokens.
 *
 * Returns `null` when there's nothing to grade yet (no typed input).
 */
export function classifyVerseAttempt(
  tokens: ReadonlyArray<DiffToken>,
): VerseAttemptQuality | null {
  if (tokens.length === 0) return null;

  const accuracy = verseAttemptAccuracy(tokens);
  if (accuracy === 100) return "exact";
  if (accuracy >= REVIEW_LAPSE_ACCURACY) return "close";
  return "off";
}

/** Stable predicate used by the UI to decide whether any error token exists. */
export function hasAttemptErrors(tokens: ReadonlyArray<DiffToken>): boolean {
  return tokens.some((t) => ERROR_STATUSES.has(t.status));
}
