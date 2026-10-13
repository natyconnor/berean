import { displayBookName, getBookInfo, type BookInfo } from "./bible-books";
import { getChapterVerseCount } from "./bible-verse-counts";
import {
  buildVerseSuggestions,
  formatBookChapter,
  resolveCanonicalBookName,
  resolveExactBookName,
} from "./verse-ref-utils";

/**
 * Autocomplete for a reference typed into a plain text input, one step at a
 * time: the book (the note editor's book completions), then its chapters,
 * then verses, then the end of a verse range. Accepting a suggestion replaces
 * the input with its `text`. Pure.
 */

export interface ReferenceSuggestion {
  key: string;
  label: string;
  description?: string;
  /** The input once the suggestion is accepted. */
  text: string;
}

const SUGGESTION_LIMIT = 6;

const EN_DASH = "\u2013";

/** "2 Peter 2", "2 Peter 2:9", "2 Peter 2:9-1"; verse and end may be empty. */
const REFERENCE_DRAFT = /^(.+?)\s+(\d+)(?::(\d*)(?:-(\d*))?)?$/;

/** Text that can only be the start of a book name: "2 pe", "Song of". */
const BOOK_DRAFT = /^[1-3]?\s*[a-z]*(?:\s+[a-z]*)*$/i;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Numbers 1…`last` that continue what was typed, not counting it. */
function continuations(typed: string, first: number, last: number): number[] {
  const numbers: number[] = [];
  for (let n = first; n <= last && numbers.length < SUGGESTION_LIMIT; n += 1) {
    const text = String(n);
    if (text.startsWith(typed) && text !== typed) numbers.push(n);
  }
  return numbers;
}

function bookSuggestions(text: string): ReferenceSuggestion[] {
  return buildVerseSuggestions(text)
    .map((item) =>
      item.kind === "book" && item.book ? getBookInfo(item.book) : undefined,
    )
    .filter((info): info is BookInfo => info !== undefined)
    .slice(0, SUGGESTION_LIMIT)
    .map((info) => ({
      key: `book:${info.name}`,
      label: info.name,
      description: plural(info.chapters, "chapter"),
      text: `${displayBookName(info.name)} `,
    }));
}

function chapterSuggestions(
  book: string,
  typed: string,
): ReferenceSuggestion[] {
  const info = getBookInfo(book);
  if (!info) return [];
  return continuations(typed, 1, info.chapters).map((chapter) => {
    const label = formatBookChapter(book, chapter);
    const verses = getChapterVerseCount(book, chapter);
    return {
      key: `chapter:${label}`,
      label,
      ...(verses ? { description: plural(verses, "verse") } : {}),
      text: label,
    };
  });
}

function verseSuggestions(
  book: string,
  chapter: number,
  typed: string,
): ReferenceSuggestion[] {
  const verses = getChapterVerseCount(book, chapter);
  if (!verses) return [];
  return continuations(typed, 1, verses).map((verse) => {
    const label = `${formatBookChapter(book, chapter)}:${verse}`;
    return { key: `verse:${label}`, label, text: label };
  });
}

function rangeEndSuggestions(
  book: string,
  chapter: number,
  startText: string,
  typed: string,
): ReferenceSuggestion[] {
  const verses = getChapterVerseCount(book, chapter);
  const start = Number.parseInt(startText, 10);
  if (!verses || !(start >= 1 && start < verses)) return [];
  return continuations(typed, start + 1, verses).map((end) => {
    const label = `${formatBookChapter(book, chapter)}:${start}${EN_DASH}${end}`;
    return {
      key: `range:${label}`,
      label,
      description: plural(end - start + 1, "verse"),
      text: label,
    };
  });
}

/** A typed book once it can only be one book: "Psalm ", "2 pe ". */
function settledBook(text: string): string | null {
  const exact = resolveExactBookName(text);
  if (exact) return exact;
  const books = buildVerseSuggestions(text).filter(
    (item) => item.kind === "book",
  );
  return books.length === 1 ? (books[0].book ?? null) : null;
}

/**
 * What can come next in `input`: books for "2 pe", chapters for "2 Peter "
 * or "Psalm 11", verses for "John 3:1", range ends for "John 3:16-". Empty
 * once nothing continues it.
 */
export function buildReferenceSuggestions(
  input: string,
): ReferenceSuggestion[] {
  const text = input.replace(/[–—]/g, "-").trimStart();
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return [];

  const draft = trimmed.match(REFERENCE_DRAFT);
  if (draft) {
    const bookText = draft[1];
    const chapterText = draft[2];
    const verseText: string | undefined = draft[3];
    const endText: string | undefined = draft[4];
    const book = /[a-z]/i.test(bookText)
      ? resolveCanonicalBookName(bookText)
      : null;
    if (!book) return [];
    if (verseText === undefined) return chapterSuggestions(book, chapterText);
    const chapter = Number.parseInt(chapterText, 10);
    return endText === undefined
      ? verseSuggestions(book, chapter, verseText)
      : rangeEndSuggestions(book, chapter, verseText, endText);
  }

  if (!BOOK_DRAFT.test(trimmed)) return [];
  const book = text === trimmed ? null : settledBook(trimmed);
  return book ? chapterSuggestions(book, "") : bookSuggestions(trimmed);
}
