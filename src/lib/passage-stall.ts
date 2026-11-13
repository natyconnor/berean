import type { DiffToken } from "./diff-words";

/**
 * Words of lead-in blanked before each missed spot. Spots this close or closer
 * join into one, since the next lead-in would cover the gap anyway.
 */
export const REPAIR_LEAD_IN_WORDS = 6;

/** Window words `[start, end)`, counted in the order `diffWords` grades them. */
export type WordRange = readonly [start: number, end: number];

/**
 * What Fix a tricky spot blanks after a missed try: each run of missed words
 * plus the up to {@link REPAIR_LEAD_IN_WORDS} words before it, never before
 * the start of the window. A missed word is one the try got wrong or left
 * out; a small typo or an extra typed word misses nothing, as in grading.
 * Overlapping or touching runs come back as one range.
 */
export function repairBlankRanges(tokens: readonly DiffToken[]): WordRange[] {
  const ranges: [number, number][] = [];
  let word = 0;
  for (const token of tokens) {
    if (token.status === "extra") continue;
    if (token.status === "mismatch" || token.status === "missing") {
      const start = Math.max(0, word - REPAIR_LEAD_IN_WORDS);
      const last = ranges[ranges.length - 1];
      if (last && start <= last[1]) last[1] = word + 1;
      else ranges.push([start, word + 1]);
    }
    word += 1;
  }
  return ranges;
}
