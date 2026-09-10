import type { DiffToken } from "./diff-words";

const STALL_STATUSES: ReadonlySet<DiffToken["status"]> = new Set([
  "mismatch",
  "missing",
  "extra",
]);

function pieceIndexForExpectedWord(
  wordIndex: number,
  pieceWordCounts: readonly number[],
): number {
  if (pieceWordCounts.length === 0) return 0;
  let remaining = Math.max(0, wordIndex);
  for (let index = 0; index < pieceWordCounts.length; index += 1) {
    const count = pieceWordCounts[index] ?? 0;
    if (remaining < count) return index;
    remaining -= count;
  }
  return pieceWordCounts.length - 1;
}

/**
 * Map the first non-typo error in a rope-window diff onto a piece. `pieceWordCounts`
 * is the window's rope pieces in recitation order (not the full passage).
 * Typos are ignored so a misspelling does not stall the window.
 */
export function stallPieceIndex(
  tokens: readonly DiffToken[],
  pieceWordCounts: readonly number[],
): number {
  if (pieceWordCounts.length === 0) return 0;

  let expectedWordIndex = 0;
  for (const token of tokens) {
    if (STALL_STATUSES.has(token.status)) {
      return pieceIndexForExpectedWord(expectedWordIndex, pieceWordCounts);
    }
    if (token.status === "match" || token.status === "typo") {
      expectedWordIndex += 1;
    }
  }

  return 0;
}

/**
 * Retry one rope piece earlier than the stall, staying inside the rehearsal
 * window. `ropeIndexes` is the window's attached/solid passage indexes in
 * recitation order (gaps allowed). `stallIndex` is the 0-based index into
 * that list, as returned by {@link stallPieceIndex}.
 */
export function repairStartIndex(
  ropeIndexes: readonly number[],
  stallIndex: number,
): number {
  if (ropeIndexes.length === 0) return 0;
  const last = ropeIndexes.length - 1;
  const local = Math.min(Math.max(stallIndex, 0), last);
  const repairLocal = Math.max(0, local - 1);
  return ropeIndexes[repairLocal] ?? ropeIndexes[0] ?? 0;
}
