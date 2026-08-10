import {
  hasMemoryVerseScope,
  memoryVerseSearch,
  validateMemoryVerseSearch,
  type MemoryVerseReference,
  type MemoryVerseScope,
  type MemoryVerseSearch,
} from "@/lib/memory-verse-search";

export type MemoryLearnSearch = MemoryVerseSearch;
export type MemoryLearnVerseScope = MemoryVerseScope;

export function validateMemoryLearnSearch(
  search: Record<string, unknown>,
): MemoryLearnSearch {
  return validateMemoryVerseSearch(search);
}

export function hasLearnVerseScope(
  search: MemoryLearnSearch,
): search is MemoryLearnVerseScope {
  return hasMemoryVerseScope(search);
}

export function memoryLearnSearch(
  reference: MemoryVerseReference,
): MemoryLearnVerseScope {
  return memoryVerseSearch(reference);
}
