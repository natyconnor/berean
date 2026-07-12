import {
  hasMemoryVerseScope,
  memoryVerseSearch,
  validateMemoryVerseSearch,
  type MemoryVerseReference,
  type MemoryVerseScope,
  type MemoryVerseSearch,
} from "@/lib/memory-verse-search";

export type MemoryPracticeSearch = MemoryVerseSearch;
export type MemoryPracticeVerseScope = MemoryVerseScope;

/** Normalize URL search into a typed practice scope (or empty = all verses). */
export function validateMemoryPracticeSearch(
  search: Record<string, unknown>,
): MemoryPracticeSearch {
  return validateMemoryVerseSearch(search);
}

/** True when search fully identifies one verse reference. */
export function hasPracticeVerseScope(
  search: MemoryPracticeSearch,
): search is MemoryPracticeVerseScope {
  return hasMemoryVerseScope(search);
}

export function memoryPracticeSearch(
  reference: MemoryVerseReference,
): MemoryPracticeVerseScope {
  return memoryVerseSearch(reference);
}
