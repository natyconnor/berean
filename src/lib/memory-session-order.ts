import {
  compareVerseRefs,
  sortByVerseRef,
} from "../../shared/compare-verse-refs";
import type { VerseRefKeyInput } from "../../shared/verse-ref-key";

import { buildPracticeOrder, type PracticeOrder } from "./practice-order";

/**
 * A session card's ordering key: an ordinary verse, or a unified pack whose
 * members should sit at the earliest verse in that passage.
 */
export type SessionOrderItem = {
  reference: VerseRefKeyInput;
  composite?: { members: readonly VerseRefKeyInput[] };
};

/**
 * Verse used to place a card in Scripture order. Unified packs sort by their
 * earliest member so the pack stays with that passage instead of the lead
 * row Convex happened to emit.
 */
export function sessionOrderRef(item: SessionOrderItem): VerseRefKeyInput {
  if (item.composite && item.composite.members.length > 0) {
    const earliest = sortByVerseRef(item.composite.members)[0];
    if (earliest) return earliest;
  }
  return item.reference;
}

/** Canonical Bible order: book, chapter, start verse, end verse. */
export function compareSessionOrderItems(
  a: SessionOrderItem,
  b: SessionOrderItem,
): number {
  return compareVerseRefs(sessionOrderRef(a), sessionOrderRef(b));
}

/**
 * Sort a mixed Learning / Review / Practice queue into Scripture order so
 * verses from the same chapter (or pack passage) stay together as a block,
 * regardless of hearted-at or due-at order.
 */
export function sortSessionVerses<T extends SessionOrderItem>(
  items: readonly T[],
): T[] {
  return [...items].sort(compareSessionOrderItems);
}

export type SessionChapterGroup<T> = {
  book: string;
  chapter: number;
  items: T[];
};

/**
 * Consecutive runs of the same book+chapter. After
 * {@link sortSessionVerses}, each chapter is a single group.
 */
export function groupSessionVersesByChapter<T extends SessionOrderItem>(
  items: readonly T[],
): SessionChapterGroup<T>[] {
  const groups: SessionChapterGroup<T>[] = [];
  for (const item of items) {
    const ref = sessionOrderRef(item);
    const last = groups[groups.length - 1];
    if (last && last.book === ref.book && last.chapter === ref.chapter) {
      last.items.push(item);
      continue;
    }
    groups.push({ book: ref.book, chapter: ref.chapter, items: [item] });
  }
  return groups;
}

/**
 * How many shuffleable sets are in this queue. One chapter (or one unified
 * pack card) is one set — Shuffle is a no-op when this is 0 or 1.
 */
export function sessionClusterCount(
  items: readonly SessionOrderItem[],
): number {
  return groupSessionVersesByChapter(sortSessionVerses(items)).length;
}

/**
 * Order a mixed session queue.
 *
 * - `"in-order"` is canonical Bible order, with same-chapter verses as one
 *   block (a chapter pack stays together).
 * - `"shuffle"` permutes those chapter / pack blocks only. Verses inside a
 *   block stay in Scripture order.
 */
export function orderSessionVerses<T extends SessionOrderItem>(
  items: readonly T[],
  order: PracticeOrder,
  seed = 0,
): T[] {
  const sorted = sortSessionVerses(items);
  if (order === "in-order" || sorted.length <= 1) return sorted;
  const clusters = groupSessionVersesByChapter(sorted);
  if (clusters.length <= 1) return sorted;
  return buildPracticeOrder(clusters, "shuffle", seed).flatMap(
    (cluster) => cluster.items,
  );
}
