import { BIBLE_BOOKS, getBookInfo } from "@/lib/bible-books";

export interface VerseRef {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export function formatVerseRef(ref: VerseRef): string {
  if (ref.startVerse === ref.endVerse) {
    return `${ref.book} ${ref.chapter}:${ref.startVerse}`;
  }
  return `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`;
}

interface ParseVerseRefOptions {
  defaultBook?: string;
  defaultChapter?: number;
}

interface BookMatch {
  name: string;
  score: number;
}

export interface VerseSuggestionItem {
  kind: "reference" | "book";
  key: string;
  label: string;
  description?: string;
  ref?: VerseRef;
  book?: string;
}

function normalizeLookupToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildBookAliasEntries(): Array<{ alias: string; name: string }> {
  const entries: Array<{ alias: string; name: string }> = [];

  const additionalAliases: Record<string, string[]> = {
    Psalms: ["Psalm", "Psa", "Psm", "Pss"],
    SongOfSolomon: ["Song of Songs", "Songs", "SOS", "Canticles"],
    Revelation: ["Revelations", "Apocalypse"],
  };

  for (const book of BIBLE_BOOKS) {
    const normalizedName = normalizeLookupToken(book.name);
    const normalizedAbbreviation = normalizeLookupToken(book.abbreviation);
    entries.push({ alias: normalizedName, name: book.name });
    entries.push({ alias: normalizedAbbreviation, name: book.name });

    const aliasCandidates =
      additionalAliases[book.name.replace(/\s/g, "")] ?? [];
    for (const alias of aliasCandidates) {
      entries.push({ alias: normalizeLookupToken(alias), name: book.name });
    }
  }

  return entries;
}

const BOOK_ALIAS_ENTRIES = buildBookAliasEntries();

export function resolveCanonicalBookName(input: string): string | null {
  const normalizedInput = normalizeLookupToken(input);
  if (!normalizedInput) return null;

  const exact = BOOK_ALIAS_ENTRIES.find(
    (entry) => entry.alias === normalizedInput,
  );
  if (exact) return exact.name;

  const prefix = BOOK_ALIAS_ENTRIES.find((entry) =>
    entry.alias.startsWith(normalizedInput),
  );
  return prefix?.name ?? null;
}

export function searchBibleBooks(input: string, limit = 8): BookMatch[] {
  const normalizedInput = normalizeLookupToken(input);
  if (!normalizedInput) return [];

  const scored = new Map<string, number>();
  for (const book of BIBLE_BOOKS) {
    const aliases = new Set(
      BOOK_ALIAS_ENTRIES.filter((entry) => entry.name === book.name).map(
        (entry) => entry.alias,
      ),
    );

    let bestScore = Number.NEGATIVE_INFINITY;
    for (const alias of aliases) {
      if (alias === normalizedInput) {
        bestScore = Math.max(bestScore, 400);
      } else if (alias.startsWith(normalizedInput)) {
        bestScore = Math.max(bestScore, 300 - alias.length);
      } else if (alias.includes(normalizedInput)) {
        bestScore = Math.max(bestScore, 100 - alias.indexOf(normalizedInput));
      }
    }

    if (bestScore > Number.NEGATIVE_INFINITY) {
      scored.set(book.name, bestScore);
    }
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, score]) => ({ name, score }));
}

export function parseVerseRef(
  str: string,
  options: ParseVerseRefOptions = {},
): VerseRef | null {
  const value = str.trim();
  if (!value) return null;

  const compactReferenceMatch = value.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (compactReferenceMatch && options.defaultBook) {
    const chapter = compactReferenceMatch[2]
      ? Number.parseInt(compactReferenceMatch[1], 10)
      : options.defaultChapter;
    const startVerse = compactReferenceMatch[2]
      ? Number.parseInt(compactReferenceMatch[2], 10)
      : Number.parseInt(compactReferenceMatch[1], 10);
    const endVerse = compactReferenceMatch[3]
      ? Number.parseInt(compactReferenceMatch[3], 10)
      : startVerse;

    if (!chapter || startVerse < 1 || endVerse < startVerse) {
      return null;
    }

    return {
      book: options.defaultBook,
      chapter,
      startVerse,
      endVerse,
    };
  }

  const match = value.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const canonicalBook = resolveCanonicalBookName(match[1]);
  if (!canonicalBook) return null;

  const chapter = Number.parseInt(match[2], 10);
  const startVerse = Number.parseInt(match[3], 10);
  const endVerse = match[4] ? Number.parseInt(match[4], 10) : startVerse;
  const bookInfo = getBookInfo(canonicalBook);

  if (!bookInfo || chapter < 1 || chapter > bookInfo.chapters) {
    return null;
  }
  if (startVerse < 1 || endVerse < startVerse) {
    return null;
  }

  return {
    book: canonicalBook,
    chapter,
    startVerse,
    endVerse,
  };
}

export function buildVerseSuggestions(
  input: string,
  options: ParseVerseRefOptions = {},
): VerseSuggestionItem[] {
  const query = input.trim();
  if (!query) return [];

  const results: VerseSuggestionItem[] = [];
  const parsedRef = parseVerseRef(query, options);
  if (parsedRef) {
    results.push({
      kind: "reference",
      key: `ref:${formatVerseRef(parsedRef)}`,
      label: formatVerseRef(parsedRef),
      description: "Insert verse link",
      ref: parsedRef,
    });
  }

  const bookQuery = query.match(/^[^\d]+/)?.[0]?.trim() ?? query;
  for (const book of searchBibleBooks(bookQuery)) {
    results.push({
      kind: "book",
      key: `book:${book.name}`,
      label: book.name,
      description: "Complete book name",
      book: book.name,
    });
  }

  return results.filter(
    (item, index, list) =>
      index === list.findIndex((candidate) => candidate.key === item.key),
  );
}

export function verseInRange(verseNum: number, ref: VerseRef): boolean {
  return verseNum >= ref.startVerse && verseNum <= ref.endVerse;
}

export function parsePassageId(passageId: string): {
  book: string;
  chapter: number;
} {
  const lastDash = passageId.lastIndexOf("-");
  const bookUrl = passageId.substring(0, lastDash);
  const chapter = parseInt(passageId.substring(lastDash + 1));
  // "1Corinthians" -> "1 Corinthians", "SongOfSolomon" -> "Song of Solomon"
  const book = bookUrl
    .replace(/(\d)([A-Z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/ Of /g, " of ");
  return { book, chapter };
}

export function toPassageId(book: string, chapter: number): string {
  // "1 Corinthians" -> "1Corinthians", "Song of Solomon" -> "SongOfSolomon"
  const urlBook = book.replace(/ of /g, " Of ").replace(/\s/g, "");
  return `${urlBook}-${chapter}`;
}

export function toEsvQuery(book: string, chapter: number): string {
  return `${book} ${chapter}`;
}

export function isPassageNote(ref: VerseRef): boolean {
  return ref.startVerse !== ref.endVerse;
}
