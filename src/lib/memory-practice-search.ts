import {
  hasMemoryVerseScope,
  memoryVerseSearch,
  validateMemoryVerseSearch,
  type MemoryVerseReference,
  type MemoryVerseScope,
  type MemoryVerseSearch,
} from "@/lib/memory-verse-search";

export type MemoryPracticeSearch = MemoryVerseSearch & { refresh?: boolean };
export type MemoryPracticeVerseScope = MemoryVerseScope;

export function parseTruthySearchFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseRefreshFlag(search: Record<string, unknown>): boolean {
  return parseTruthySearchFlag(search.refresh);
}

/** Normalize URL search into a typed practice scope (or empty = all verses). */
export function validateMemoryPracticeSearch(
  search: Record<string, unknown>,
): MemoryPracticeSearch {
  const base = validateMemoryVerseSearch(search);
  return parseRefreshFlag(search) ? { ...base, refresh: true } : base;
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
