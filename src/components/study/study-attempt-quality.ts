import type { DiffToken } from "@/lib/diff-words";
import { REVIEW_LAPSE_ACCURACY } from "@/lib/memory-scheduler";

/**
 * How close the user's typed verse came to the actual text.
 *
 * - `exact`: every diff token matched (ignoring case, punctuation, and dashes),
 *   or the only errors are at most {@link MAX_EXACT_TYPOS} minor typos.
 * - `close`: imperfect, but accuracy at or above {@link REVIEW_LAPSE_ACCURACY}.
 * - `off`: accuracy below {@link REVIEW_LAPSE_ACCURACY}.
 */
export type VerseAttemptQuality = "exact" | "close" | "off";

/** Minor spelling typos still count as exact if there are at most this many. */
export const MAX_EXACT_TYPOS = 2;

/** Errors we count when scoring a typed attempt. */
const ERROR_STATUSES: ReadonlySet<DiffToken["status"]> = new Set([
  "typo",
  "mismatch",
  "missing",
  "extra",
]);

/** A minor spelling typo keeps most of the word's credit. */
const TYPO_CREDIT = 0.8;

export function verseAttemptAccuracy(tokens: ReadonlyArray<DiffToken>): number {
  if (tokens.length === 0) return 0;

  let credit = 0;
  for (const token of tokens) {
    if (token.status === "match") credit += 1;
    if (token.status === "typo") credit += TYPO_CREDIT;
  }
  return Math.round((credit / tokens.length) * 100);
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
  if (accuracy === 100 || isExactExceptTypos(tokens)) return "exact";
  if (accuracy >= REVIEW_LAPSE_ACCURACY) return "close";
  return "off";
}

/** True when the only errors are at most {@link MAX_EXACT_TYPOS} typos. */
function isExactExceptTypos(tokens: ReadonlyArray<DiffToken>): boolean {
  let typos = 0;
  for (const token of tokens) {
    if (token.status === "match") continue;
    if (token.status !== "typo") return false;
    typos += 1;
    if (typos > MAX_EXACT_TYPOS) return false;
  }
  return true;
}

/** Stable predicate used by the UI to decide whether any error token exists. */
export function hasAttemptErrors(tokens: ReadonlyArray<DiffToken>): boolean {
  return tokens.some((t) => ERROR_STATUSES.has(t.status));
}
