import type * as XLSX from "xlsx";

import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import { getCanonicalBookNameFromFileName } from "@/lib/note-transfer/books";
import { parseImportedNoteCell } from "@/lib/note-transfer/note-cells";
import type {
  ImportIssue,
  ParsedImportPreview,
  ParsedImportWorkbook,
  ParsedImportedNote,
} from "@/lib/note-transfer/types";

const OMITTED_VERSE_WARNINGS_SUPPRESSED: Partial<
  Record<string, Partial<Record<number, readonly number[]>>>
> = {
  Matthew: {
    12: [47],
    17: [21],
    18: [11],
    23: [14],
  },
  Mark: {
    7: [16],
    9: [44, 46],
    11: [26],
    15: [28],
  },
  Luke: {
    17: [36],
    23: [17],
  },
  John: {
    5: [4],
  },
  Acts: {
    8: [37],
    15: [34],
    24: [7],
    28: [29],
  },
  Romans: {
    16: [24],
  },
};

function toCellString(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/\r\n/g, "\n").trim();
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value).trim();
  }
  return "";
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => toCellString(cell).length === 0);
}

function trimTrailingEmptyRows(rows: unknown[][]): unknown[][] {
  const result = [...rows];
  while (result.length > 0 && isEmptyRow(result[result.length - 1] ?? [])) {
    result.pop();
  }
  return result;
}

export function parseChapterSheetName(sheetName: string): number | null {
  const match = sheetName.trim().match(/^chapter\s*0*(\d+)$/i);
  if (!match) return null;
  const chapter = Number.parseInt(match[1], 10);
  return Number.isFinite(chapter) && chapter > 0 ? chapter : null;
}

function hasHeaderRow(rows: unknown[][]): boolean {
  const firstCell = toCellString(rows[0]?.[0]);
  return firstCell.toLowerCase() === "verse";
}

function parseLeadingVerseNumber(value: string): number | null {
  const match = value.match(/^(\d+)(\D|$)/);
  if (!match) return null;

  const verseNumber = Number.parseInt(match[1], 10);
  return Number.isFinite(verseNumber) && verseNumber > 0 ? verseNumber : null;
}

function isSuppressedMissingVerse(
  book: string,
  chapter: number,
  verse: number,
): boolean {
  return (
    OMITTED_VERSE_WARNINGS_SUPPRESSED[book]?.[chapter]?.includes(verse) ?? false
  );
}

function formatVerseList(verses: number[]): string {
  if (verses.length === 0) return "";

  const sortedVerses = [...verses].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sortedVerses[0];
  let previousVerse = sortedVerses[0];

  for (let index = 1; index < sortedVerses.length; index += 1) {
    const verse = sortedVerses[index];
    if (verse === previousVerse + 1) {
      previousVerse = verse;
      continue;
    }

    ranges.push(
      rangeStart === previousVerse
        ? String(rangeStart)
        : `${rangeStart}-${previousVerse}`,
    );
    rangeStart = verse;
    previousVerse = verse;
  }

  ranges.push(
    rangeStart === previousVerse
      ? String(rangeStart)
      : `${rangeStart}-${previousVerse}`,
  );

  return ranges.join(", ");
}

function createIssue(
  issue: Omit<ImportIssue, "fileName">,
  fileName: string,
): ImportIssue {
  return {
    ...issue,
    fileName,
  };
}

export function parseImportWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string,
  utils: typeof XLSX.utils,
): ParsedImportWorkbook {
  const book = getCanonicalBookNameFromFileName(fileName);
  const issues: ImportIssue[] = [];
  const notes: ParsedImportedNote[] = [];
  const chapterNumbers: number[] = [];
  const seenChapters = new Set<number>();

  if (!book) {
    issues.push(
      createIssue(
        {
          severity: "error",
          code: "unknown-book",
          message: "Could not determine the Bible book from the file name.",
        },
        fileName,
      ),
    );
    return {
      fileName,
      book: null,
      notes,
      issues,
      chapterNumbers,
    };
  }

  for (const sheetName of workbook.SheetNames) {
    const chapter = parseChapterSheetName(sheetName);
    if (!chapter) {
      issues.push(
        createIssue(
          {
            severity: "error",
            code: "invalid-sheet-name",
            message: `Sheet "${sheetName}" must be named like "Chapter 01".`,
            sheetName,
          },
          fileName,
        ),
      );
      continue;
    }

    if (seenChapters.has(chapter)) {
      issues.push(
        createIssue(
          {
            severity: "error",
            code: "duplicate-chapter",
            message: `Chapter ${chapter} appears more than once in this workbook.`,
            sheetName,
          },
          fileName,
        ),
      );
      continue;
    }

    seenChapters.add(chapter);
    chapterNumbers.push(chapter);

    const expectedVerseCount = getChapterVerseCount(book, chapter);
    if (!expectedVerseCount) {
      issues.push(
        createIssue(
          {
            severity: "error",
            code: "invalid-chapter",
            message: `${book} does not have chapter ${chapter}.`,
            sheetName,
          },
          fileName,
        ),
      );
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    const rows = trimTrailingEmptyRows(rawRows);

    if (rows.length === 0) {
      issues.push(
        createIssue(
          {
            severity: "warning",
            code: "empty-sheet",
            message: `Sheet "${sheetName}" is empty and was skipped.`,
            sheetName,
          },
          fileName,
        ),
      );
      continue;
    }

    const headerRowPresent = hasHeaderRow(rows);
    const dataRows = headerRowPresent ? rows.slice(1) : rows;
    const parsedRows: Array<{
      row: unknown[];
      verseNumber: number;
    }> = [];
    const seenVerseNumbers = new Set<number>();
    let previousVerseNumber = 0;
    let hasVerseRowErrors = false;

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
      const row = dataRows[rowIndex] ?? [];
      const rowNumber = rowIndex + (headerRowPresent ? 2 : 1);
      const verseCell = toCellString(row[0]);
      const verseNumber = parseLeadingVerseNumber(verseCell);

      if (!verseNumber) {
        hasVerseRowErrors = true;
        issues.push(
          createIssue(
            {
              severity: "error",
              code: "invalid-verse-number",
              message: `Sheet "${sheetName}" row ${rowNumber} must start with a verse number.`,
              sheetName,
            },
            fileName,
          ),
        );
        continue;
      }

      if (verseNumber > expectedVerseCount) {
        hasVerseRowErrors = true;
        issues.push(
          createIssue(
            {
              severity: "error",
              code: "verse-number-out-of-range",
              message: `Sheet "${sheetName}" row ${rowNumber} starts with verse ${verseNumber}, but ${book} ${chapter} only has ${expectedVerseCount} canonical verses.`,
              sheetName,
            },
            fileName,
          ),
        );
        continue;
      }

      if (seenVerseNumbers.has(verseNumber)) {
        hasVerseRowErrors = true;
        issues.push(
          createIssue(
            {
              severity: "error",
              code: "duplicate-verse-number",
              message: `Sheet "${sheetName}" row ${rowNumber} repeats verse ${verseNumber}.`,
              sheetName,
            },
            fileName,
          ),
        );
        continue;
      }

      if (verseNumber < previousVerseNumber) {
        hasVerseRowErrors = true;
        issues.push(
          createIssue(
            {
              severity: "error",
              code: "out-of-order-verse-number",
              message: `Sheet "${sheetName}" row ${rowNumber} is out of order: verse ${verseNumber} follows verse ${previousVerseNumber}.`,
              sheetName,
            },
            fileName,
          ),
        );
        continue;
      }

      seenVerseNumbers.add(verseNumber);
      previousVerseNumber = verseNumber;
      parsedRows.push({
        row,
        verseNumber,
      });
    }

    if (!hasVerseRowErrors) {
      const missingVerses: number[] = [];
      for (let verse = 1; verse <= expectedVerseCount; verse += 1) {
        if (!seenVerseNumbers.has(verse)) {
          missingVerses.push(verse);
        }
      }

      const unexpectedMissingVerses = missingVerses.filter(
        (verse) => !isSuppressedMissingVerse(book, chapter, verse),
      );
      if (unexpectedMissingVerses.length > 0) {
        issues.push(
          createIssue(
            {
              severity: "warning",
              code: "missing-verse-rows",
              message: `Sheet "${sheetName}" is missing verse rows: ${formatVerseList(unexpectedMissingVerses)}.`,
              sheetName,
            },
            fileName,
          ),
        );
      }
    }

    for (const parsedRow of parsedRows) {
      for (
        let columnIndex = 1;
        columnIndex < parsedRow.row.length;
        columnIndex += 1
      ) {
        const parsedCell = parseImportedNoteCell(parsedRow.row[columnIndex]);
        if (!parsedCell) continue;

        notes.push({
          book,
          chapter,
          verse: parsedRow.verseNumber,
          content: parsedCell.content,
          tags: parsedCell.tags,
          sourceFileName: fileName,
          sourceSheetName: sheetName,
        });
      }
    }
  }

  return {
    fileName,
    book,
    notes,
    issues,
    chapterNumbers: chapterNumbers.sort((a, b) => a - b),
  };
}

export function buildImportPreview(
  workbooks: ParsedImportWorkbook[],
): ParsedImportPreview {
  const issues = workbooks.flatMap((workbook) => workbook.issues);
  const notes = workbooks.flatMap((workbook) => workbook.notes);
  const seenBooks = new Map<string, string>();

  for (const workbook of workbooks) {
    if (!workbook.book) continue;

    const previousFileName = seenBooks.get(workbook.book);
    if (previousFileName) {
      issues.push({
        severity: "error",
        code: "duplicate-book-file",
        message: `Book "${workbook.book}" appears in both "${previousFileName}" and "${workbook.fileName}".`,
        fileName: workbook.fileName,
      });
      continue;
    }

    seenBooks.set(workbook.book, workbook.fileName);
  }

  return {
    workbooks,
    notes,
    issues,
  };
}
