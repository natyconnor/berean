import type { EsvVerse } from "@/lib/esv-api";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import {
  formatExportWorkbookFileName,
  getBookOrder,
} from "@/lib/note-transfer/books";
import { serializeExportedNoteCell } from "@/lib/note-transfer/note-cells";
import type { ExportableLinkedNote } from "@/lib/note-transfer/types";

export function formatChapterSheetName(chapter: number): string {
  return `Chapter ${String(chapter).padStart(2, "0")}`;
}

export function getExportBooks(
  notes: ExportableLinkedNote[],
  scope: "booksWithNotes" | "allBooks",
): string[] {
  if (scope === "allBooks") {
    return BIBLE_BOOKS.map((book) => book.name);
  }

  const books = Array.from(new Set(notes.map((note) => note.verseRef.book)));
  return books.sort((a, b) => getBookOrder(a) - getBookOrder(b));
}

export function groupExportNotesByBook(
  notes: ExportableLinkedNote[],
): Map<string, Map<number, Map<number, ExportableLinkedNote[]>>> {
  const grouped = new Map<
    string,
    Map<number, Map<number, ExportableLinkedNote[]>>
  >();

  for (const note of notes) {
    const verseRef = note.verseRef;
    const bookMap =
      grouped.get(verseRef.book) ??
      new Map<number, Map<number, ExportableLinkedNote[]>>();
    const chapterMap =
      bookMap.get(verseRef.chapter) ??
      new Map<number, ExportableLinkedNote[]>();
    const anchorVerse = verseRef.startVerse;
    const verseNotes = chapterMap.get(anchorVerse) ?? [];
    verseNotes.push(note);
    chapterMap.set(anchorVerse, verseNotes);
    bookMap.set(verseRef.chapter, chapterMap);
    grouped.set(verseRef.book, bookMap);
  }

  return grouped;
}

export function buildChapterExportRows(
  verses: EsvVerse[],
  notesByVerse: Map<number, ExportableLinkedNote[]> | undefined,
): string[][] {
  let maxNotesPerVerse = 0;
  for (const verse of verses) {
    const count = notesByVerse?.get(verse.number)?.length ?? 0;
    if (count > maxNotesPerVerse) {
      maxNotesPerVerse = count;
    }
  }

  const header = ["Verse"];
  for (let index = 1; index <= maxNotesPerVerse; index += 1) {
    header.push(`Note ${index}`);
  }

  const rows = [header];
  for (const verse of verses) {
    const row = [`${verse.number} ${verse.text}`];
    const verseNotes = notesByVerse?.get(verse.number) ?? [];
    for (const note of verseNotes) {
      row.push(serializeExportedNoteCell(note.content, note.tags));
    }
    while (row.length < header.length) {
      row.push("");
    }
    rows.push(row);
  }

  return rows;
}

export function getExportWorkbookName(book: string): string {
  return formatExportWorkbookFileName(book);
}
