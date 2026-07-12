export interface MemoryVerseSearch {
  book?: string;
  chapter?: number;
  startVerse?: number;
  endVerse?: number;
}

export interface MemoryVerseScope {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface MemoryVerseReference {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

function parsePositiveInt(value: unknown): number | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return undefined;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : undefined;
}

export function validateMemoryVerseSearch(
  search: Record<string, unknown>,
): MemoryVerseSearch {
  const book = typeof search.book === "string" ? search.book.trim() : "";
  const chapter = parsePositiveInt(search.chapter);
  const startVerse = parsePositiveInt(search.startVerse);
  const endVerseCandidate = parsePositiveInt(search.endVerse);

  if (!book || chapter === undefined || startVerse === undefined) {
    return {};
  }

  const endVerse =
    endVerseCandidate === undefined
      ? startVerse
      : Math.max(startVerse, endVerseCandidate);

  return { book, chapter, startVerse, endVerse };
}

export function hasMemoryVerseScope(
  search: MemoryVerseSearch,
): search is MemoryVerseScope {
  return (
    typeof search.book === "string" &&
    search.book.length > 0 &&
    typeof search.chapter === "number" &&
    typeof search.startVerse === "number" &&
    typeof search.endVerse === "number"
  );
}

export function memoryVerseSearch(
  reference: MemoryVerseReference,
): MemoryVerseScope {
  return {
    book: reference.book,
    chapter: reference.chapter,
    startVerse: reference.startVerse,
    endVerse: reference.endVerse,
  };
}
