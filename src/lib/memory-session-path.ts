import type { TodaySessionOnly } from "./memory-today-session";

/**
 * Memory session routes: Learn / Practice / Review, including pack-scoped
 * sessions. The Mode Dock skips live `dueCount` here so `await mutation()`
 * after a grade does not wait on the library-wide due scan.
 *
 * `/memory` home, pack view, presets, and new-pack stay subscribed.
 */
export function isMemorySessionPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (
    path === "/memory/today" ||
    path === "/memory/learn" ||
    path === "/memory/practice" ||
    path === "/memory/review"
  ) {
    return true;
  }
  return /^\/memory\/[^/]+\/(learn|practice|review)$/.test(path);
}

export type MemorySessionKind = "learn" | "review" | "practice";

/** A one-verse session, e.g. `/memory/review?book=Luke&chapter=9&startVerse=23&endVerse=24`. */
export function memoryVerseSessionHref(
  kind: MemorySessionKind,
  reference: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  },
): string {
  const params = new URLSearchParams({
    book: reference.book,
    chapter: String(reference.chapter),
    startVerse: String(reference.startVerse),
    endVerse: String(reference.endVerse),
  });
  return `/memory/${kind}?${params.toString()}`;
}

/**
 * The blended session: building passages, then learning, then reviews.
 * With `packId`, only that pack's work today. With `only`, just passages and
 * new verses, or just reviews.
 */
export function memoryTodaySessionHref(scope?: {
  packId?: string;
  only?: TodaySessionOnly;
}): string {
  const params = new URLSearchParams();
  if (scope?.packId !== undefined) params.set("packId", scope.packId);
  if (scope?.only !== undefined) params.set("only", scope.only);
  const query = params.toString();
  return query === "" ? "/memory/today" : `/memory/today?${query}`;
}

/** A pack or passage session, e.g. `/memory/$packId/learn`. */
export function memoryPackSessionHref(
  kind: MemorySessionKind,
  packId: string,
): string {
  return `/memory/${encodeURIComponent(packId)}/${kind}`;
}
