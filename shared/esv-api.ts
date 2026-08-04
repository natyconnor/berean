export interface EsvVerseHeading {
  text: string;
  /** Character offset into the verse's `text` at which the heading is printed. */
  offset: number;
  /** Whether the HTML heading is editorial or an always-visible subheading. */
  variant?: "section" | "sub";
}

export interface EsvVerse {
  number: number;
  text: string;
  /**
   * Section heading printed immediately before this verse, when present.
   * Multiple stacked headings (e.g. Psalm 1's "Book One") are newline-joined.
   */
  heading?: string;
  /**
   * ESV "subheading" printed immediately before this verse: Psalm 119's acrostic
   * letters, Song of Solomon speakers, and psalm titles. Omitted when absent.
   */
  subheading?: string;
  /**
   * Headings printed partway through this verse: section headings (2 Samuel
   * 12:15) or known subheadings (Song of Solomon speakers). Omitted when none.
   */
  midHeadings?: EsvVerseHeading[];
}

export interface EsvChapterData {
  canonical: string;
  verses: EsvVerse[];
  copyright: string;
}

/** Bumped when cached chapter shape, parsing, or cache keying changes. */
const CACHE_PREFIX = "esv_cache_v10_";

function passageCacheKey(query: string): string {
  return `${CACHE_PREFIX}${query}`;
}

function parseStoredJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isEsvVerseHeading(value: unknown): value is EsvVerseHeading {
  return (
    isRecord(value) &&
    typeof value.text === "string" &&
    typeof value.offset === "number" &&
    (value.variant === undefined ||
      value.variant === "section" ||
      value.variant === "sub")
  );
}

function isEsvVerse(value: unknown): value is EsvVerse {
  if (!isRecord(value)) return false;
  if (typeof value.number !== "number" || typeof value.text !== "string") {
    return false;
  }
  if (value.heading !== undefined && typeof value.heading !== "string") {
    return false;
  }
  if (value.subheading !== undefined && typeof value.subheading !== "string") {
    return false;
  }
  if (
    value.midHeadings !== undefined &&
    !(
      Array.isArray(value.midHeadings) &&
      value.midHeadings.every(isEsvVerseHeading)
    )
  ) {
    return false;
  }
  return true;
}

export function isEsvChapterData(value: unknown): value is EsvChapterData {
  if (!isRecord(value)) return false;
  return (
    typeof value.canonical === "string" &&
    typeof value.copyright === "string" &&
    Array.isArray(value.verses) &&
    value.verses.every(isEsvVerse)
  );
}

export function getCachedPassage(query: string): EsvChapterData | null {
  try {
    const cached = sessionStorage.getItem(passageCacheKey(query));
    if (!cached) return null;
    const parsed = parseStoredJson(cached);
    return isEsvChapterData(parsed) ? parsed : null;
  } catch {
    // ignore
  }
  return null;
}

export function setCachedPassage(query: string, data: EsvChapterData): void {
  try {
    sessionStorage.setItem(passageCacheKey(query), JSON.stringify(data));
  } catch {
    // ignore — sessionStorage might be full
  }
}

/** Narrow full-chapter ESV data to an inclusive verse range (for previews). */
export function sliceEsvChapterToVerseRange(
  chapter: EsvChapterData,
  startVerse: number,
  endVerse: number,
): EsvChapterData {
  const lo = Math.min(startVerse, endVerse);
  const hi = Math.max(startVerse, endVerse);
  return {
    ...chapter,
    verses: chapter.verses.filter((v) => v.number >= lo && v.number <= hi),
  };
}
