import { parseMemoryPanelFrom, type MemoryPanelFrom } from "./memory-panel";
import { parseTruthySearchFlag } from "./memory-practice-search";

export type MemoryPackSearch = {
  /** Opened from Your verses: the page shows "‹ Your verses". */
  from?: MemoryPanelFrom;
  startOver?: boolean;
};

/** `/memory/$packId` search. Old `heartHint` / `startPassage` links are dropped. */
export function validateMemoryPackSearch(
  search: Record<string, unknown>,
): MemoryPackSearch {
  const from = parseMemoryPanelFrom(search.from);
  const startOver = parseTruthySearchFlag(search.startOver) ? true : undefined;
  return {
    ...(from ? { from } : {}),
    ...(startOver ? { startOver } : {}),
  };
}
