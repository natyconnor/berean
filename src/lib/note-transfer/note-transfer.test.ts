import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  formatExportWorkbookFileName,
  getCanonicalBookNameFromFileName,
} from "@/lib/note-transfer/books";
import { buildChapterExportRows } from "@/lib/note-transfer/export";
import {
  buildImportPreview,
  parseChapterSheetName,
  parseImportWorkbook,
} from "@/lib/note-transfer/import";
import {
  parseImportedNoteCell,
  serializeExportedNoteCell,
} from "@/lib/note-transfer/note-cells";
import type { ExportableLinkedNote } from "@/lib/note-transfer/types";

function createChapterWorkbook(
  sheetName: string,
  verseNumbers: number[],
  options: {
    includeHeader?: boolean;
    overrideVerseCell?: (verse: number, rowIndex: number) => string;
    noteCellsByVerse?: Record<number, string[]>;
  } = {},
) {
  const rows: string[][] = [];
  if (options.includeHeader ?? true) {
    rows.push(["Verse", "Note 1", "Note 2"]);
  }

  for (let rowIndex = 0; rowIndex < verseNumbers.length; rowIndex += 1) {
    const verse = verseNumbers[rowIndex];
    const cells = options.noteCellsByVerse?.[verse] ?? [];
    rows.push([
      options.overrideVerseCell?.(verse, rowIndex) ?? `${verse} Verse ${verse}`,
      ...cells,
    ]);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    sheetName,
  );
  return workbook;
}

function createGenesisChapterWorkbook(
  sheetName: string,
  options: {
    includeHeader?: boolean;
    overrideVerseCell?: (verse: number) => string;
    noteCellsByVerse?: Record<number, string[]>;
  } = {},
) {
  return createChapterWorkbook(
    sheetName,
    Array.from({ length: 31 }, (_, index) => index + 1),
    {
      includeHeader: options.includeHeader,
      noteCellsByVerse: options.noteCellsByVerse,
      overrideVerseCell: (verse) =>
        options.overrideVerseCell?.(verse) ?? `${verse} Genesis 1:${verse}`,
    },
  );
}

describe("note transfer filename helpers", () => {
  it("parses canonical books from supported file names", () => {
    expect(getCanonicalBookNameFromFileName("Genesis.xlsx")).toBe("Genesis");
    expect(getCanonicalBookNameFromFileName("01 Genesis.xlsx")).toBe("Genesis");
    expect(getCanonicalBookNameFromFileName("11 1 Kings.xlsx")).toBe("1 Kings");
    expect(getCanonicalBookNameFromFileName("02-EXODUS.xlsx")).toBe("Exodus");
  });

  it("formats export workbook names with zero-padded order", () => {
    expect(formatExportWorkbookFileName("Genesis")).toBe("01 Genesis.xlsx");
    expect(formatExportWorkbookFileName("1 Kings")).toBe("11 1 Kings.xlsx");
  });
});

describe("note transfer note cell helpers", () => {
  it("parses a trailing hashtag line into tags", () => {
    expect(
      parseImportedNoteCell("Line one\nLine two\n#holiness, #sin & repentance"),
    ).toEqual({
      content: "Line one\nLine two",
      tags: ["holiness", "sin & repentance"],
    });
  });

  it("ignores hashtags outside the final line", () => {
    expect(
      parseImportedNoteCell("Mention #jesus in prose\nSecond line"),
    ).toEqual({
      content: "Mention #jesus in prose\nSecond line",
      tags: [],
    });
  });

  it("serializes tags as a trailing hashtag line", () => {
    expect(
      serializeExportedNoteCell("A note", ["holiness", "sin & repentance"]),
    ).toBe("A note\n#holiness, #sin & repentance");
  });
});

describe("note transfer workbook parsing", () => {
  it("accepts Chapter 1 and an optional header row", () => {
    const workbook = createGenesisChapterWorkbook("Chapter 1", {
      includeHeader: true,
      noteCellsByVerse: {
        1: ["First note\n#faith", "Second note"],
      },
    });

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(parsed.book).toBe("Genesis");
    expect(parsed.chapterNumbers).toEqual([1]);
    expect(parsed.notes).toEqual([
      {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        content: "First note",
        tags: ["faith"],
        sourceFileName: "Genesis.xlsx",
        sourceSheetName: "Chapter 1",
      },
      {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        content: "Second note",
        tags: [],
        sourceFileName: "Genesis.xlsx",
        sourceSheetName: "Chapter 1",
      },
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it("accepts sheets without a header row", () => {
    const workbook = createGenesisChapterWorkbook("chapter 01", {
      includeHeader: false,
      noteCellsByVerse: {
        2: ["No header note"],
      },
    });

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0]?.verse).toBe(2);
    expect(parsed.issues).toEqual([]);
  });

  it("reports invalid sheet names", () => {
    const workbook = createGenesisChapterWorkbook("Gen 1");
    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(parsed.issues[0]?.code).toBe("invalid-sheet-name");
  });

  it("accepts known omitted verses without warnings", () => {
    const workbook = createChapterWorkbook(
      "Chapter 16",
      Array.from({ length: 27 }, (_, index) => index + 1).filter(
        (verse) => verse !== 24,
      ),
      {
        noteCellsByVerse: {
          25: ["Sparse note"],
        },
      },
    );

    const parsed = parseImportWorkbook(workbook, "Romans.xlsx", XLSX.utils);

    expect(parsed.notes).toEqual([
      {
        book: "Romans",
        chapter: 16,
        verse: 25,
        content: "Sparse note",
        tags: [],
        sourceFileName: "Romans.xlsx",
        sourceSheetName: "Chapter 16",
      },
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it("accepts other allowlisted omitted verses without warnings", () => {
    const workbook = createChapterWorkbook(
      "Chapter 17",
      Array.from({ length: 27 }, (_, index) => index + 1).filter(
        (verse) => verse !== 21,
      ),
      {
        noteCellsByVerse: {
          22: ["Matthew sparse note"],
        },
        overrideVerseCell: (verse) => `${verse} Matthew 17:${verse}`,
      },
    );

    const parsed = parseImportWorkbook(workbook, "Matthew.xlsx", XLSX.utils);

    expect(parsed.notes).toEqual([
      {
        book: "Matthew",
        chapter: 17,
        verse: 22,
        content: "Matthew sparse note",
        tags: [],
        sourceFileName: "Matthew.xlsx",
        sourceSheetName: "Chapter 17",
      },
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it("warns on unexpected missing verse rows without blocking import", () => {
    const workbook = createChapterWorkbook(
      "Chapter 01",
      Array.from({ length: 31 }, (_, index) => index + 1).filter(
        (verse) => verse !== 5,
      ),
      {
        noteCellsByVerse: {
          6: ["Sparse note"],
        },
        overrideVerseCell: (verse) => `${verse} Genesis 1:${verse}`,
      },
    );

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(parsed.notes).toEqual([
      {
        book: "Genesis",
        chapter: 1,
        verse: 6,
        content: "Sparse note",
        tags: [],
        sourceFileName: "Genesis.xlsx",
        sourceSheetName: "Chapter 01",
      },
    ]);
    expect(parsed.issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "missing-verse-rows",
      }),
    ]);
  });

  it("reports invalid verse labels", () => {
    const workbook = createGenesisChapterWorkbook("Chapter 01", {
      overrideVerseCell: (verse) =>
        verse === 5 ? "Wrong verse" : `${verse} Genesis 1:${verse}`,
    });

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(
      parsed.issues.some((issue) => issue.code === "invalid-verse-number"),
    ).toBe(true);
  });

  it("reports duplicate verse numbers", () => {
    const workbook = createChapterWorkbook(
      "Chapter 01",
      [
        ...Array.from({ length: 10 }, (_, index) => index + 1),
        10,
        ...Array.from({ length: 20 }, (_, index) => index + 11),
      ],
      {
        overrideVerseCell: (verse) => `${verse} Genesis 1:${verse}`,
      },
    );

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(
      parsed.issues.some((issue) => issue.code === "duplicate-verse-number"),
    ).toBe(true);
  });

  it("reports out-of-order verse numbers", () => {
    const workbook = createChapterWorkbook(
      "Chapter 01",
      [
        1,
        2,
        3,
        4,
        6,
        5,
        ...Array.from({ length: 25 }, (_, index) => index + 7),
      ],
      {
        overrideVerseCell: (verse) => `${verse} Genesis 1:${verse}`,
      },
    );

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(
      parsed.issues.some((issue) => issue.code === "out-of-order-verse-number"),
    ).toBe(true);
  });

  it("reports verse numbers outside the canonical range", () => {
    const workbook = createChapterWorkbook(
      "Chapter 01",
      [...Array.from({ length: 31 }, (_, index) => index + 1), 32],
      {
        overrideVerseCell: (verse) => `${verse} Genesis 1:${verse}`,
      },
    );

    const parsed = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);

    expect(
      parsed.issues.some((issue) => issue.code === "verse-number-out-of-range"),
    ).toBe(true);
  });

  it("detects duplicate books across a preview", () => {
    const workbook = createGenesisChapterWorkbook("Chapter 01");
    const first = parseImportWorkbook(workbook, "Genesis.xlsx", XLSX.utils);
    const second = parseImportWorkbook(workbook, "01 Genesis.xlsx", XLSX.utils);

    const preview = buildImportPreview([first, second]);

    expect(
      preview.issues.some((issue) => issue.code === "duplicate-book-file"),
    ).toBe(true);
  });
});

describe("note transfer export shaping", () => {
  it("pads note columns to the maximum note count for the chapter", () => {
    const notesByVerse = new Map<number, ExportableLinkedNote[]>([
      [
        1,
        [
          {
            noteId: "n1",
            content: "First note",
            tags: ["faith"],
            createdAt: 1,
            updatedAt: 1,
            verseRef: {
              book: "Genesis",
              chapter: 1,
              startVerse: 1,
              endVerse: 1,
            },
          },
          {
            noteId: "n2",
            content: "Passage note",
            tags: [],
            createdAt: 2,
            updatedAt: 2,
            verseRef: {
              book: "Genesis",
              chapter: 1,
              startVerse: 1,
              endVerse: 3,
            },
          },
        ],
      ],
    ]);

    const rows = buildChapterExportRows(
      [
        { number: 1, text: "In the beginning" },
        { number: 2, text: "The earth was without form" },
      ],
      notesByVerse,
    );

    expect(rows[0]).toEqual(["Verse", "Note 1", "Note 2"]);
    expect(rows[1]).toEqual([
      "1 In the beginning",
      "First note\n#faith",
      "Passage note",
    ]);
    expect(rows[2]).toEqual(["2 The earth was without form", "", ""]);
  });
});

describe("chapter sheet name parsing", () => {
  it("accepts zero-padded or non-padded chapter names", () => {
    expect(parseChapterSheetName("Chapter 1")).toBe(1);
    expect(parseChapterSheetName("chapter 01")).toBe(1);
    expect(parseChapterSheetName("Chapter 010")).toBe(10);
  });
});
