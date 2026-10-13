import { parseMemoryPanelFrom, type MemoryPanelFrom } from "./memory-panel";

export type MemoryPackSearch = {
  /** Opened from Your verses: the page shows "‹ Your verses". */
  from?: MemoryPanelFrom;
};

/** `/memory/$packId` search. Old `heartHint` / `startPassage` links are dropped. */
export function validateMemoryPackSearch(
  search: Record<string, unknown>,
): MemoryPackSearch {
  const from = parseMemoryPanelFrom(search.from);
  return from ? { from } : {};
}
