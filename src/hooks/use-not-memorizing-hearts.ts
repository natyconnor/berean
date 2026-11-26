import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";
import { NOT_MEMORIZING_MAX_LIMIT } from "@/lib/heart-list";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";

export type HeartItem = FunctionReturnType<
  typeof api.savedVerses.listNotMemorizing
>[number];

export function heartSpan(item: HeartItem): VerseSpan {
  return {
    book: item.book,
    chapter: item.chapter,
    startVerse: item.startVerse,
    endVerse: item.endVerse,
  };
}

/** Hearts not being memorized, newest first; `undefined` while loading. */
export function useNotMemorizingHearts(): HeartItem[] | undefined {
  return useQuery(api.savedVerses.listNotMemorizing, {
    limit: NOT_MEMORIZING_MAX_LIMIT,
  });
}
