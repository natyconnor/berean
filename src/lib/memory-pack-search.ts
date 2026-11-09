import {
  validateMemoryReturnSearch,
  type MemoryReturnSearch,
} from "./memory-return";
import { parseMemoryPanelFrom, type MemoryPanelFrom } from "./memory-panel";
import { parseRefreshSearch } from "./memory-verse-search";

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

/** `/memory/$packId/review` and `/practice` search: a passage Refresh opens with `refresh=1`. */
export type MemoryPackSessionSearch = MemoryReturnSearch & { refresh?: true };

export function validateMemoryPackSessionSearch(
  search: Record<string, unknown>,
): MemoryPackSessionSearch {
  return {
    ...validateMemoryReturnSearch(search),
    ...parseRefreshSearch(search),
  };
}
