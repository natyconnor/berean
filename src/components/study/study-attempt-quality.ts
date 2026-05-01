import type { DiffToken } from "@/lib/diff-words";

/**
 * How close the user's typed verse came to the actual text.
 *
 * - `exact`: every diff token matched (ignoring case and trailing punctuation).
 * - `close`: one or two small slips on a verse the user otherwise nailed.
 * - `off`: more than a few slips, or a short verse with a significant miss.
 */
export type VerseAttemptQuality = "exact" | "close" | "off";

/** Errors we count when scoring a typed attempt. */
const ERROR_STATUSES: ReadonlySet<DiffToken["status"]> = new Set([
  "mismatch",
  "missing",
  "extra",
]);

// Thresholds chosen to feel generous on longer verses without letting a
// two-word verse where the user got one word wrong count as "really close".
const MAX_CLOSE_ERRORS = 3;
const MIN_CLOSE_MATCH_RATIO = 0.8;

/**
 * Classify a typed verse-memory attempt based on its diff tokens.
 *
 * Returns `null` when there's nothing to grade yet (no typed input).
 */
export function classifyVerseAttempt(
  tokens: ReadonlyArray<DiffToken>,
): VerseAttemptQuality | null {
  if (tokens.length === 0) return null;

  let matches = 0;
  let mismatches = 0;
  let missing = 0;
  let extras = 0;
  for (const token of tokens) {
    switch (token.status) {
      case "match":
        matches += 1;
        break;
      case "mismatch":
        mismatches += 1;
        break;
      case "missing":
        missing += 1;
        break;
      case "extra":
        extras += 1;
        break;
    }
  }

  const errors = mismatches + missing + extras;
  if (errors === 0) return "exact";

  // Match ratio against the larger of the two word counts so that a typed
  // attempt with lots of extras doesn't silently pass as "close".
  const actualLen = matches + mismatches + missing;
  const typedLen = matches + mismatches + extras;
  const denom = Math.max(actualLen, typedLen, 1);
  const matchRatio = matches / denom;

  if (errors <= MAX_CLOSE_ERRORS && matchRatio >= MIN_CLOSE_MATCH_RATIO) {
    return "close";
  }
  return "off";
}

/** Stable predicate used by the UI to decide whether any error token exists. */
export function hasAttemptErrors(tokens: ReadonlyArray<DiffToken>): boolean {
  return tokens.some((t) => ERROR_STATUSES.has(t.status));
}
