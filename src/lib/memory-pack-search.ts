export type MemoryPackSearch = {
  heartHint?: boolean;
};

/** `?heartHint=1` after creating a scope pack, so the view can point at Heart. */
export function validateMemoryPackSearch(
  search: Record<string, unknown>,
): MemoryPackSearch {
  if (
    search.heartHint === true ||
    search.heartHint === 1 ||
    search.heartHint === "1" ||
    search.heartHint === "true"
  ) {
    return { heartHint: true };
  }
  return {};
}
