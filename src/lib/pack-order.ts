/**
 * Custom-pack order edits, shared by `packs.reorder`, `packs.restoreVerse`
 * and the pack editors. Pure. Convex imports this module, so it must only use
 * relative imports.
 */

/** A copy of `items` with the item at `from` moved to `to`. Out-of-range moves change nothing. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= next.length ||
    to >= next.length
  ) {
    return next;
  }
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Where a dragged item lands when dropped in gap `gap` (0 is before the first
 * item, `n` after the last). `null` when the drop leaves it where it was.
 */
export function dropTargetIndex(from: number, gap: number): number | null {
  const to = gap > from ? gap - 1 : gap;
  return to === from ? null : to;
}

/**
 * `items` in the order `keys` lists them. Items `keys` misses keep their
 * relative order after the listed ones, and unknown keys are skipped, so a
 * stale local order never hides or duplicates an item.
 */
export function orderByKeys<T>(
  items: readonly T[],
  keys: readonly string[] | null,
  keyOf: (item: T) => string,
): T[] {
  if (!keys) return [...items];
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const placed = new Set<string>();
  const ordered: T[] = [];
  for (const key of keys) {
    const item = byKey.get(key);
    if (item === undefined || placed.has(key)) continue;
    placed.add(key);
    ordered.push(item);
  }
  for (const item of items) {
    if (!placed.has(keyOf(item))) ordered.push(item);
  }
  return ordered;
}

export interface PackOrderRow<V extends string = string> {
  verseRefId: V;
  /** In Memory, so the pack shows it. Rows for stopped verses stay hidden. */
  inMemory: boolean;
}

function isPermutationOf<V>(expected: readonly V[], given: readonly V[]) {
  if (expected.length !== given.length) return false;
  const remaining = new Set(expected);
  return given.every((id) => remaining.delete(id));
}

/**
 * The new order of every `packVerses` row of a custom pack, or `null` when
 * `ordered` is not a permutation of them. `rows` are in their current order.
 *
 * `ordered` lists either every row or only the rows in Memory (what the pack
 * shows). In the second case, hidden rows keep their slots and the shown rows
 * fill the others in the new order, so memorizing a stopped verse again puts
 * it back where it was.
 */
export function planPackReorder<V extends string>(
  rows: readonly PackOrderRow<V>[],
  ordered: readonly V[],
): V[] | null {
  if (new Set(ordered).size !== ordered.length) return null;

  const all = rows.map((row) => row.verseRefId);
  if (isPermutationOf(all, ordered)) return [...ordered];

  const shown = rows.filter((row) => row.inMemory).map((row) => row.verseRefId);
  if (!isPermutationOf(shown, ordered)) return null;

  let next = 0;
  return rows.map((row) => (row.inMemory ? ordered[next++] : row.verseRefId));
}

/**
 * Where an undone removal goes back in. `at` is the removed row's `order`
 * (clamped to a whole number ≥ 0). When another row has taken that slot, every
 * row from it on shifts down one, so the restored row lands at its old place
 * and the rest keep their relative order.
 */
export function planRestoreAt<R extends { order: number }>(
  rows: readonly R[],
  at: number,
): { order: number; shift: R[] } {
  const order = Number.isFinite(at) ? Math.max(0, Math.floor(at)) : 0;
  const taken = rows.some((row) => row.order === order);
  return {
    order,
    shift: taken ? rows.filter((row) => row.order >= order) : [],
  };
}
