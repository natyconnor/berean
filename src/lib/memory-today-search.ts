import { validateMemoryReturnSearch } from "@/lib/memory-return";

export interface MemoryTodaySearch {
  /** Run only this pack's work today. */
  packId?: string;
  /** Where Done, Stop for today, and the back link go. */
  return?: string;
}

const PACK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** `/memory/today` search: an optional pack scope and the session return. */
export function validateMemoryTodaySearch(
  search: Record<string, unknown>,
): MemoryTodaySearch {
  const packId =
    typeof search.packId === "string" && PACK_ID_PATTERN.test(search.packId)
      ? search.packId
      : undefined;
  return {
    ...(packId === undefined ? {} : { packId }),
    ...validateMemoryReturnSearch(search),
  };
}
