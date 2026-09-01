/**
 * Pure ordering helpers for the Practice board.
 *
 * Practice plays a chosen set of verses one at a time, either in canonical
 * order (via an optional comparator) or in a shuffled sequence. The shuffle is
 * driven by a small seeded PRNG so a given `(items, seed)` pair always
 * produces the same order — this keeps the sequence stable across re-renders
 * and makes the logic unit-testable without depending on `Math.random()`.
 */

export type PracticeOrder = "in-order" | "shuffle";

/**
 * `mulberry32` — a tiny, fast, deterministic PRNG. Given the same seed it emits
 * the same stream of floats in `[0, 1)`, which is all a seeded shuffle needs.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the ordered practice set from a verse list.
 *
 * - `"in-order"` returns a shallow copy. When `compare` is provided, that
 *   copy is sorted (memory sessions pass canonical Bible order so a mixed
 *   Continue Learning queue is not newest-hearted-first). Without `compare`,
 *   the original sequence is preserved.
 * - `"shuffle"` returns a seeded Fisher–Yates permutation; the same `seed`
 *   always yields the same order, and a new `seed` reshuffles.
 *
 * The input is never mutated.
 */
export function buildPracticeOrder<T>(
  items: readonly T[],
  order: PracticeOrder,
  seed = 0,
  compare?: (a: T, b: T) => number,
): T[] {
  const result = [...items];
  if (result.length <= 1) return result;
  if (order === "in-order") {
    if (compare) result.sort(compare);
    return result;
  }

  const random = createSeededRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/** Index of the next item, wrapping back to the start at the end. */
export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}

/** Index of the previous item, wrapping to the end at the start. */
export function prevIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current - 1 + length) % length;
}
