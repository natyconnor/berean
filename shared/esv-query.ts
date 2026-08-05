import { getBookInfo } from "../src/lib/bible-books";

/**
 * Obadiah, Philemon, 2 John, 3 John, and Jude.
 *
 * The ESV API treats these as chapterless: `Jude 1` resolves to Jude verse 1
 * rather than the whole chapter, so a chapter-numbered query returns a single
 * verse. The bare book name returns every verse.
 */
export function isSingleChapterBook(book: string): boolean {
  return getBookInfo(book)?.chapters === 1;
}

/** Build the ESV `q` parameter for a whole chapter. */
export function toEsvQuery(book: string, chapter: number): string {
  return isSingleChapterBook(book) ? book : `${book} ${chapter}`;
}
