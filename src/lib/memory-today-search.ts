import { validateMemoryReturnSearch } from "@/lib/memory-return";
import type { TodaySessionOnly } from "@/lib/memory-today-session";

export interface MemoryTodaySearch {
  /** Run only this pack's work today. */
  packId?: string;
  /** Run only one half of today: passages and new verses, or reviews. */
  only?: TodaySessionOnly;
  /** Where Done, Stop for today, and the back link go. */
  return?: string;
}

const PACK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** `/memory/today` search: an optional pack scope, half of the day, and the session return. */
export function validateMemoryTodaySearch(
  search: Record<string, unknown>,
): MemoryTodaySearch {
  const packId =
    typeof search.packId === "string" && PACK_ID_PATTERN.test(search.packId)
      ? search.packId
      : undefined;
  const only =
    search.only === "learning" || search.only === "review"
      ? search.only
      : undefined;
  return {
    ...(packId === undefined ? {} : { packId }),
    ...(only === undefined ? {} : { only }),
    ...validateMemoryReturnSearch(search),
  };
}
