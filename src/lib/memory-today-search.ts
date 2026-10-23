import { validateMemoryReturnSearch } from "@/lib/memory-return";
import type { TodaySessionOnly } from "@/lib/memory-today-session";

export interface MemoryTodaySearch {
  /** Run only this pack's work today. */
  packId?: string;
  /** Run only one half of today: passages and new verses, or reviews. */
  only?: TodaySessionOnly;
  /** The open queue item (passage pack id or verse key). */
  item?: string;
  /** Where Done, Stop for today, and the back link go. */
  return?: string;
}

const PACK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Passage pack ids, `unified:packId`, or a `verseRefKey`. */
function validateTodayItem(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const item = value.trim();
  if (item.length === 0 || item.length > 128) return undefined;
  if (item.includes("/") || item.includes("\\") || item.includes("..")) {
    return undefined;
  }
  return item;
}

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
  const item = validateTodayItem(search.item);
  return {
    ...(packId === undefined ? {} : { packId }),
    ...(only === undefined ? {} : { only }),
    ...(item === undefined ? {} : { item }),
    ...validateMemoryReturnSearch(search),
  };
}
