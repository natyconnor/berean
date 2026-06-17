import { BIBLE_BOOKS } from "../src/lib/bible-books";
import type { VerseRefKeyInput } from "./verse-ref-key";

function bookOrderIndex(book: string): number {
  const idx = BIBLE_BOOKS.findIndex((entry) => entry.name === book);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/** Canonical Bible order: book, chapter, start verse, end verse. */
export function compareVerseRefs(
  a: VerseRefKeyInput,
  b: VerseRefKeyInput,
): number {
  const byBook = bookOrderIndex(a.book) - bookOrderIndex(b.book);
  if (byBook !== 0) return byBook;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  if (a.startVerse !== b.startVerse) return a.startVerse - b.startVerse;
  return a.endVerse - b.endVerse;
}

export function sortByVerseRef<T extends VerseRefKeyInput>(
  items: readonly T[],
): T[] {
  return [...items].sort(compareVerseRefs);
}
