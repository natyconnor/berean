import type { VerseSpan } from "./hearted-verse-coverage";
import { displayBookName } from "./bible-books";
import { formatVerseRefTitle } from "./verse-ref-utils";

/** Most hearts `savedVerses.listNotMemorizing` returns. */
export const NOT_MEMORIZING_MAX_LIMIT = 30;

/** Heart rows `savedVerses.listNotMemorizing` reads before it stops looking. */
export const NOT_MEMORIZING_SCAN_CAP = 500;

/**
 * The row a multi-chapter passage heart is listed at in a newest-first list:
 * the newest by `createdAt`, then `_creationTime`, i.e. the first one the
 * `by_userId_createdAt` index yields in descending order. Every page agrees on
 * it, so the passage shows up once however its rows fall across pages.
 */
export function passageHeartAnchor<
  T extends { createdAt: number; _creationTime: number },
>(rows: readonly T[]): T | undefined {
  let anchor: T | undefined;
  for (const row of rows) {
    if (
      !anchor ||
      row.createdAt > anchor.createdAt ||
      (row.createdAt === anchor.createdAt &&
        row._creationTime > anchor._creationTime)
    ) {
      anchor = row;
    }
  }
  return anchor;
}

/** The row for a passage's first chapter: what its list item opens. */
export function firstChapterHeart<T extends { span: VerseSpan }>(
  rows: readonly T[],
): T | undefined {
  let first: T | undefined;
  for (const row of rows) {
    if (
      !first ||
      row.span.chapter < first.span.chapter ||
      (row.span.chapter === first.span.chapter &&
        row.span.startVerse < first.span.startVerse)
    ) {
      first = row;
    }
  }
  return first;
}

type ListedHeart = VerseSpan & { passage?: { title: string } };

/** "Romans 8:28", or "Psalm 16 · passage" for a memorized passage's heart. */
export function heartListLabel(item: ListedHeart): string {
  return item.passage
    ? `${item.passage.title} · passage`
    : formatVerseRefTitle(item);
}

/**
 * True when the filter text appears in the book's name ("Psalms"), its
 * reference form ("Psalm"), or its abbreviation. An empty filter matches all.
 */
export function heartMatchesBookFilter(
  book: string,
  filter: string,
  abbreviation?: string,
): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  return [book, displayBookName(book), abbreviation ?? ""].some((name) =>
    name.toLowerCase().includes(query),
  );
}

/**
 * Hearts grouped by book. Groups keep the order their book first appears in
 * and rows keep their order within a group, so a newest-first list stays
 * newest first and loading another page never moves rows already shown.
 */
export function groupHeartsByBook<T extends { book: string }>(
  items: readonly T[],
): { book: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.book);
    if (group) group.push(item);
    else groups.set(item.book, [item]);
  }
  return [...groups].map(([book, rows]) => ({ book, items: rows }));
}
