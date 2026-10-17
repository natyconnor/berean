import { BIBLE_BOOKS } from "./bible-books";

const SECTION_BOUNDS = [
  { id: "law", title: "Law", first: "Genesis", last: "Deuteronomy" },
  { id: "history", title: "History", first: "Joshua", last: "Esther" },
  {
    id: "wisdom",
    title: "Wisdom & Poetry",
    first: "Job",
    last: "Song of Solomon",
  },
  { id: "prophets", title: "Prophets", first: "Isaiah", last: "Malachi" },
  { id: "gospels", title: "Gospels & Acts", first: "Matthew", last: "Acts" },
  { id: "letters", title: "Letters", first: "Romans", last: "Jude" },
  {
    id: "revelation",
    title: "Revelation",
    first: "Revelation",
    last: "Revelation",
  },
] as const;

export type BibleSectionId = (typeof SECTION_BOUNDS)[number]["id"];

/** A traditional division of the canon: a run of consecutive books. */
export interface BibleSection {
  id: BibleSectionId;
  title: string;
  /** Canonical order. */
  books: readonly string[];
}

function bookIndex(name: string): number {
  const index = BIBLE_BOOKS.findIndex((book) => book.name === name);
  if (index < 0) throw new Error(`Unknown book ${name}`);
  return index;
}

/** Every section in canonical order; together they cover each book once. */
export const BIBLE_SECTIONS: readonly BibleSection[] = SECTION_BOUNDS.map(
  ({ id, title, first, last }) => ({
    id,
    title,
    books: BIBLE_BOOKS.slice(bookIndex(first), bookIndex(last) + 1).map(
      (book) => book.name,
    ),
  }),
);

const SECTION_BY_BOOK = new Map(
  BIBLE_SECTIONS.flatMap((section) =>
    section.books.map((book) => [book, section] as const),
  ),
);

/** The section a canonical book name ("Psalms", "1 John") belongs to. */
export function bibleSectionOf(book: string): BibleSection | undefined {
  return SECTION_BY_BOOK.get(book);
}

export interface BibleSectionGroup<T> {
  section: BibleSection;
  items: T[];
}

/**
 * Items grouped by section, sections in canonical order and items in the
 * order given. Sections with no items are left out, and so are items whose
 * book isn't a canonical name.
 */
export function groupByBibleSection<T>(
  items: readonly T[],
  bookOf: (item: T) => string,
): BibleSectionGroup<T>[] {
  const bySection = new Map<BibleSectionId, T[]>();
  for (const item of items) {
    const section = bibleSectionOf(bookOf(item));
    if (!section) continue;
    const list = bySection.get(section.id);
    if (list) list.push(item);
    else bySection.set(section.id, [item]);
  }
  return BIBLE_SECTIONS.flatMap((section) => {
    const list = bySection.get(section.id);
    return list ? [{ section, items: list }] : [];
  });
}
