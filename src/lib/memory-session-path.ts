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
    path === "/memory/learn" ||
    path === "/memory/practice" ||
    path === "/memory/review"
  ) {
    return true;
  }
  return /^\/memory\/[^/]+\/(learn|practice|review)$/.test(path);
}
