import {
  hasMemoryVerseScope,
  memoryVerseSearch,
  validateMemoryVerseSearch,
  type MemoryVerseReference,
  type MemoryVerseScope,
  type MemoryVerseSearch,
} from "@/lib/memory-verse-search";

export type MemoryReviewSearch = MemoryVerseSearch;
export type MemoryReviewVerseScope = MemoryVerseScope;

export function validateMemoryReviewSearch(
  search: Record<string, unknown>,
): MemoryReviewSearch {
  return validateMemoryVerseSearch(search);
}

export function hasReviewVerseScope(
  search: MemoryReviewSearch,
): search is MemoryReviewVerseScope {
  return hasMemoryVerseScope(search);
}

export function memoryReviewSearch(
  reference: MemoryVerseReference,
): MemoryReviewVerseScope {
  return memoryVerseSearch(reference);
}
