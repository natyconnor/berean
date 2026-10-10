import { BIBLE_BOOKS, type BookInfo } from "../src/lib/bible-books";
import { getChapterVerseCount } from "../src/lib/bible-verse-counts";

/**
 * Passage URLs are `/passage/{Book}-{chapter}`, matching `toPassageId` in
 * `src/lib/verse-ref-utils.ts` (`Song of Solomon` → `SongOfSolomon-1`).
 * Book matching ignores case, spaces, and "of" so `songofsolomon` still
 * resolves. The returned id uses the canonical book spelling.
 */

function bookLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toPassageId(book: string, chapter: number): string {
  const urlBook = book.replace(/ of /g, " Of ").replace(/\s/g, "");
  return `${urlBook}-${chapter}`;
}

const BOOK_BY_KEY = new Map<string, BookInfo>(
  BIBLE_BOOKS.map((book) => [bookLookupKey(book.name), book]),
);

const POSITIVE_INT = /^[1-9]\d*$/;

function parsePositiveInt(value: string): number | null {
  if (!POSITIVE_INT.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Canonical `/passage/...` id, or null when the reference cannot be a chapter. */
export function canonicalPassageId(passageId: string): string | null {
  const dash = passageId.lastIndexOf("-");
  if (dash <= 0 || dash === passageId.length - 1) return null;

  const chapter = parsePositiveInt(passageId.slice(dash + 1));
  if (chapter === null) return null;

  const book = BOOK_BY_KEY.get(bookLookupKey(passageId.slice(0, dash)));
  if (!book || chapter > book.chapters) return null;

  return toPassageId(book.name, chapter);
}

/**
 * True when a passage URL's verse query names a verse this chapter does not
 * have. Absent verse params, and an `endVerse` with no `startVerse`, stay
 * valid — that matches the passage route's existing search parsing.
 * An `endVerse` below `startVerse` is valid because the route clamps it up.
 */
export function passageVerseSearchIsInvalid(
  canonicalPathname: string,
  search: string,
): boolean {
  if (!canonicalPathname.startsWith("/passage/")) return false;

  const passageId = canonicalPassageId(
    canonicalPathname.slice("/passage/".length),
  );
  if (!passageId) return true;

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const startRaw = params.get("startVerse");
  if (startRaw === null) return false;

  const dash = passageId.lastIndexOf("-");
  const book = BOOK_BY_KEY.get(bookLookupKey(passageId.slice(0, dash)));
  const chapter = Number(passageId.slice(dash + 1));
  const verseCount =
    book === undefined ? null : getChapterVerseCount(book.name, chapter);
  if (verseCount === null) return true;

  const start = parsePositiveInt(startRaw);
  if (start === null || start > verseCount) return true;

  const endRaw = params.get("endVerse");
  if (endRaw === null) return false;
  const end = parsePositiveInt(endRaw);
  if (end === null || end > verseCount) return true;

  return false;
}
