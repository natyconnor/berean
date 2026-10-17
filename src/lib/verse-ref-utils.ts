import {
  BIBLE_BOOKS,
  displayBookName,
  formatBookChapter,
  getBookInfo,
} from "@/lib/bible-books";
import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";

export { formatBookChapter };

export type VerseRefScope = "chapter";

export interface VerseRef {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  /** Present when the link targets an entire chapter (anchor verses are 1–1). */
  scope?: VerseRefScope;
}

export function isChapterScopeRef(
  ref: Pick<VerseRef, "scope"> | VerseRef,
): boolean {
  return ref.scope === "chapter";
}

export function formatVerseRef(ref: VerseRef): string {
  if (isChapterScopeRef(ref)) {
    return formatBookChapter(ref.book, ref.chapter);
  }
  const book = displayBookName(ref.book);
  if (ref.startVerse === ref.endVerse) {
    return `${book} ${ref.chapter}:${ref.startVerse}`;
  }
  return `${book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`;
}

/** "Romans 8:28–30": {@link formatVerseRef} with an en dash, for Memory's titles. */
export function formatVerseRefTitle(ref: VerseRef): string {
  if (isChapterScopeRef(ref) || ref.startVerse === ref.endVerse) {
    return formatVerseRef(ref);
  }
  return `${displayBookName(ref.book)} ${ref.chapter}:${ref.startVerse}\u2013${ref.endVerse}`;
}

/** Smallest start through largest end, using the first ref's book and chapter. */
export function unionVerseRefs(refs: readonly VerseRef[]): VerseRef | null {
  if (refs.length === 0) return null;

  const first = refs[0];
  let startVerse = first.startVerse;
  let endVerse = first.endVerse;
  for (const ref of refs) {
    startVerse = Math.min(startVerse, ref.startVerse);
    endVerse = Math.max(endVerse, ref.endVerse);
  }

  return {
    book: first.book,
    chapter: first.chapter,
    startVerse,
    endVerse,
  };
}

export function formatVerseRange(
  ref: Pick<VerseRef, "startVerse" | "endVerse">,
): string {
  if (ref.startVerse === ref.endVerse) return String(ref.startVerse);
  return `${ref.startVerse}-${ref.endVerse}`;
}

export function verseRefsHaveMixedRanges(refs: readonly VerseRef[]): boolean {
  if (refs.length < 2) return false;
  const first = refs[0];
  return refs.some(
    (ref) =>
      ref.startVerse !== first.startVerse || ref.endVerse !== first.endVerse,
  );
}

interface ParseVerseRefOptions {
  defaultBook?: string;
  defaultChapter?: number;
  /** When true, accepts `Book Chapter` (e.g. `John 3`) as a chapter-scoped ref. */
  allowChapterOnly?: boolean;
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
    Judges: ["Jdg"],
    Psalms: ["Psalm", "Psa", "Psm", "Pss"],
    SongOfSolomon: ["Song of Songs", "Songs", "SOS", "Canticles"],
    Ezekiel: ["Ezk"],
    Matthew: ["Mt"],
    Mark: ["Mk", "Mrk"],
    Luke: ["Lk"],
    John: ["Jn", "Jhn"],
    Philippians: ["Php"],
    Philemon: ["Phm"],
    "1John": ["1 Jn"],
    "2John": ["2 Jn"],
    "3John": ["3 Jn"],
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

function findExactBookAlias(normalizedInput: string): string | null {
  return (
    BOOK_ALIAS_ENTRIES.find((entry) => entry.alias === normalizedInput)?.name ??
    null
  );
}

export function resolveCanonicalBookName(input: string): string | null {
  const normalizedInput = normalizeLookupToken(input);
  if (!normalizedInput) return null;

  const exact = findExactBookAlias(normalizedInput);
  if (exact) return exact;

  const prefix = BOOK_ALIAS_ENTRIES.find((entry) =>
    entry.alias.startsWith(normalizedInput),
  );
  return prefix?.name ?? null;
}

/** The book a name or alias names exactly ("Psalm", "Rom"); no prefixes. */
export function resolveExactBookName(input: string): string | null {
  const normalizedInput = normalizeLookupToken(input);
  if (!normalizedInput) return null;
  return (
    BOOK_ALIAS_ENTRIES.find((entry) => entry.alias === normalizedInput)?.name ??
    null
  );
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

    if (!chapter) {
      return null;
    }

    return {
      book: options.defaultBook,
      chapter,
      startVerse,
      endVerse,
    };
  }

  const verseMatch = value.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (verseMatch) {
    const canonicalBook = resolveCanonicalBookName(verseMatch[1]);
    if (!canonicalBook) return null;

    const chapter = Number.parseInt(verseMatch[2], 10);
    const startVerse = Number.parseInt(verseMatch[3], 10);
    const endVerse = verseMatch[4]
      ? Number.parseInt(verseMatch[4], 10)
      : startVerse;
    const bookInfo = getBookInfo(canonicalBook);

    if (!bookInfo || chapter < 1 || chapter > bookInfo.chapters) {
      return null;
    }

    return {
      book: canonicalBook,
      chapter,
      startVerse,
      endVerse,
    };
  }

  const bareNumberMatch = value.match(/^(.+?)\s+(\d+)(?:-(\d+))?$/);
  if (bareNumberMatch) {
    const canonicalBook = resolveCanonicalBookName(bareNumberMatch[1]);
    if (!canonicalBook) return null;

    const bookInfo = getBookInfo(canonicalBook);
    if (!bookInfo) return null;

    const start = Number.parseInt(bareNumberMatch[2], 10);
    const end = bareNumberMatch[3]
      ? Number.parseInt(bareNumberMatch[3], 10)
      : start;
    const isRange = bareNumberMatch[3] !== undefined;

    if (bookInfo.chapters === 1) {
      return {
        book: canonicalBook,
        chapter: 1,
        startVerse: start,
        endVerse: end,
      };
    }

    if (!options.allowChapterOnly || isRange) {
      return null;
    }

    if (start < 1 || start > bookInfo.chapters) {
      return null;
    }

    return {
      book: canonicalBook,
      chapter: start,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    };
  }

  if (!options.allowChapterOnly) return null;

  const exactBook = findExactBookAlias(normalizeLookupToken(value));
  const exactBookInfo = exactBook ? getBookInfo(exactBook) : undefined;
  if (!exactBook || exactBookInfo?.chapters !== 1) return null;

  return {
    book: exactBook,
    chapter: 1,
    startVerse: 1,
    endVerse: 1,
    scope: "chapter",
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
  if (parsedRef && !getVerseRefBoundsErrorMessage(parsedRef)) {
    results.push({
      kind: "reference",
      key: `ref:${formatVerseRef(parsedRef)}`,
      label: formatVerseRef(parsedRef),
      description: isChapterScopeRef(parsedRef)
        ? "Insert chapter link"
        : "Insert verse link",
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

export function isPassageNote(ref: VerseRef): boolean {
  return ref.startVerse !== ref.endVerse;
}
