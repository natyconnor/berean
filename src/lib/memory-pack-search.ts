export type MemoryPackSearch = {
  heartHint?: boolean;
  /** One-shot builder shortcut: start passage mode once after create. */
  startPassage?: boolean;
};

function isTruthySearchFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** `?heartHint=1` after creating a scope pack, so the view can point at Heart. */
export function validateMemoryPackSearch(
  search: Record<string, unknown>,
): MemoryPackSearch {
  const next: MemoryPackSearch = {};
  if (isTruthySearchFlag(search.heartHint)) {
    next.heartHint = true;
  }
  if (isTruthySearchFlag(search.startPassage)) {
    next.startPassage = true;
  }
  return next;
}
