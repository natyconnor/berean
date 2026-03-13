import { BIBLE_BOOKS } from "@/lib/bible-books";

function normalizeBookToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BOOK_NAME_LOOKUP = new Map(
  BIBLE_BOOKS.map((book) => [normalizeBookToken(book.name), book.name]),
);

export function getBookOrder(book: string): number {
  const index = BIBLE_BOOKS.findIndex((entry) => entry.name === book);
  return index >= 0 ? index + 1 : -1;
}

export function formatBookOrder(order: number): string {
  return String(order).padStart(2, "0");
}

export function formatExportWorkbookFileName(book: string): string {
  return `${formatBookOrder(getBookOrder(book))} ${book}.xlsx`;
}

export function getCanonicalBookNameFromFileName(
  fileName: string,
): string | null {
  const basename = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .trim();

  if (!basename) return null;

  const directMatch = BOOK_NAME_LOOKUP.get(normalizeBookToken(basename));
  if (directMatch) {
    return directMatch;
  }

  const withoutSortPrefix = basename.replace(/^\d+\s*[-_.()]*\s*/, "").trim();
  if (!withoutSortPrefix) return null;

  return BOOK_NAME_LOOKUP.get(normalizeBookToken(withoutSortPrefix)) ?? null;
}
