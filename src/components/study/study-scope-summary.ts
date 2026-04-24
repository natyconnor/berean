import { BIBLE_BOOKS } from "@/lib/bible-books";

export interface StudyScope {
  books: string[];
  chapterRanges?: Array<{
    book: string;
    startChapter: number;
    endChapter: number;
  }>;
  tags: string[];
  tagMatchMode: "any" | "all";
}

const OT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "OT").map(
  (b) => b.name,
);
const NT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "NT").map(
  (b) => b.name,
);
const GOSPEL_BOOKS = ["Matthew", "Mark", "Luke", "John"];
const PAULINE_BOOKS = [
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
];

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}

function formatBookWithRange(
  book: string,
  ranges?: StudyScope["chapterRanges"],
): string {
  const range = ranges?.find((r) => r.book === book);
  if (!range) return book;
  if (range.startChapter === range.endChapter) {
    return `${book} ${range.startChapter}`;
  }
  return `${book} ${range.startChapter}\u2013${range.endChapter}`;
}

export function formatScopeSummary(scope: StudyScope): string {
  const parts: string[] = [];

  if (scope.books.length === 0) {
    parts.push("All Scripture");
  } else if (sameSet(scope.books, OT_BOOKS)) {
    parts.push("Old Testament");
  } else if (sameSet(scope.books, NT_BOOKS)) {
    parts.push("New Testament");
  } else if (sameSet(scope.books, GOSPEL_BOOKS)) {
    parts.push("Gospels");
  } else if (sameSet(scope.books, PAULINE_BOOKS)) {
    parts.push("Paul\u2019s Letters");
  } else if (scope.books.length <= 3) {
    parts.push(
      scope.books
        .map((b) => formatBookWithRange(b, scope.chapterRanges))
        .join(", "),
    );
  } else {
    parts.push(`${scope.books.length} books`);
  }

  if (scope.tags.length > 0) {
    parts.push(scope.tags.join(", "));
  }

  return parts.join(" \u00b7 ");
}
