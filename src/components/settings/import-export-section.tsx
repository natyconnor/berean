import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import {
  Loader2,
  Upload,
  Download,
  CheckCircle2,
  FileArchive,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logInteraction } from "@/lib/dev-log";
import {
  buildChapterExportRows,
  formatChapterSheetName,
  getExportBooks,
  getExportWorkbookName,
  groupExportNotesByBook,
} from "@/lib/note-transfer/export";
import {
  buildImportPreview,
  parseImportWorkbook,
} from "@/lib/note-transfer/import";
import type {
  ExportScope,
  ImportIssue,
  ParsedImportPreview,
  ParsedImportWorkbook,
} from "@/lib/note-transfer/types";

const IMPORT_BATCH_SIZE = 100;
const EXPORT_ENABLED = false;

function hasFileDragPayload(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function isIgnorableZipEntry(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;
  return (
    normalized.endsWith("/") ||
    normalized.startsWith("__MACOSX/") ||
    basename === ".DS_Store"
  );
}

function createImportIssue(
  severity: ImportIssue["severity"],
  code: string,
  message: string,
  fileName?: string,
): ImportIssue {
  return { severity, code, message, fileName };
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function formatIssueLocation(issue: ImportIssue): string {
  const parts = [issue.fileName, issue.sheetName].filter(Boolean);
  return parts.length > 0 ? `${parts.join(" / ")}: ` : "";
}

function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  );
}

export function ImportExportSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importNotesBatch = useMutation(api.noteTransfer.importNotesBatch);
  const fetchChaptersTextBatch = useAction(api.esv.getChaptersTextBatch);
  const exportableNotes = useQuery(
    api.noteTransfer.listExportableNotes,
    EXPORT_ENABLED ? {} : "skip",
  );

  const [importPreview, setImportPreview] =
    useState<ParsedImportPreview | null>(null);
  const [importParseState, setImportParseState] = useState<
    "idle" | "parsing" | "parsed" | "error"
  >("idle");
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [isImportDropActive, setIsImportDropActive] = useState(false);
  const [areImportWorkbooksExpanded, setAreImportWorkbooksExpanded] =
    useState(false);
  const [importProgress, setImportProgress] = useState<{
    processedBatches: number;
    totalBatches: number;
    importedCount: number;
  } | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<
    string | null
  >(null);

  const [exportScope, setExportScope] = useState<ExportScope>("booksWithNotes");
  const [exportProgress, setExportProgress] = useState<{
    currentBook: string;
    completedBooks: number;
    totalBooks: number;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const importErrors = useMemo(
    () =>
      importPreview?.issues.filter((issue) => issue.severity === "error") ?? [],
    [importPreview],
  );
  const importWarnings = useMemo(
    () =>
      importPreview?.issues.filter((issue) => issue.severity === "warning") ??
      [],
    [importPreview],
  );
  const importErrorCount = importErrors.length;
  const importWarningCount = importWarnings.length;
  const importChapterCount = useMemo(
    () =>
      importPreview?.workbooks.reduce(
        (total, workbook) => total + workbook.chapterNumbers.length,
        0,
      ) ?? 0,
    [importPreview],
  );
  const isImportBusy =
    importParseState === "parsing" || importProgress !== null;
  const hasBlockingImportIssues = importErrorCount > 0;

  const clearImportInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetImportState = ({
    preserveSuccessMessage = false,
  }: {
    preserveSuccessMessage?: boolean;
  } = {}) => {
    setImportPreview(null);
    setImportParseState("idle");
    setImportParseError(null);
    setIsImportDropActive(false);
    setAreImportWorkbooksExpanded(false);
    if (!preserveSuccessMessage) {
      setImportSuccessMessage(null);
    }
    clearImportInput();
  };

  const handleImportFiles = async (files: File[]) => {
    resetImportState();

    if (files.length === 0) {
      return;
    }

    logInteraction("import-export", "import-parse-started", {
      fileCount: files.length,
    });
    setImportParseState("parsing");

    try {
      const XLSX = await import("xlsx");
      const extraIssues: ImportIssue[] = [];
      const parsedWorkbooks: ParsedImportWorkbook[] = [];

      const parseWorkbookBinary = (
        fileName: string,
        binary: ArrayBuffer | Uint8Array,
      ) => {
        const workbook = XLSX.read(binary, { type: "array" });
        parsedWorkbooks.push(
          parseImportWorkbook(workbook, fileName, XLSX.utils),
        );
      };

      for (const file of files) {
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith(".xlsx")) {
          parseWorkbookBinary(file.name, await file.arrayBuffer());
          continue;
        }

        if (lowerName.endsWith(".zip")) {
          const { unzipSync } = await import("fflate");
          const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
          for (const [entryName, entryData] of Object.entries(entries)) {
            if (isIgnorableZipEntry(entryName)) continue;
            if (entryName.toLowerCase().endsWith(".xlsx")) {
              parseWorkbookBinary(entryName, entryData);
              continue;
            }

            extraIssues.push(
              createImportIssue(
                "error",
                "unsupported-zip-entry",
                "Zip archives may only contain .xlsx workbooks.",
                entryName,
              ),
            );
          }
          continue;
        }

        extraIssues.push(
          createImportIssue(
            "error",
            "unsupported-file-type",
            "Only .xlsx files or .zip archives containing .xlsx files are supported.",
            file.name,
          ),
        );
      }

      const preview = buildImportPreview(parsedWorkbooks);
      setImportPreview({
        ...preview,
        issues: [...preview.issues, ...extraIssues],
      });
      setImportParseState("parsed");
      logInteraction("import-export", "import-parse-completed", {
        errorCount: [...preview.issues, ...extraIssues].filter(
          (issue) => issue.severity === "error",
        ).length,
        noteCount: preview.notes.length,
        warningCount: [...preview.issues, ...extraIssues].filter(
          (issue) => issue.severity === "warning",
        ).length,
        workbookCount: preview.workbooks.length,
      });
    } catch (error) {
      setImportParseState("error");
      logInteraction("import-export", "import-parse-failed", {
        message: error instanceof Error ? error.message : "unknown-error",
      });
      setImportParseError(
        error instanceof Error
          ? error.message
          : "Failed to parse import files.",
      );
    } finally {
      clearImportInput();
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    void handleImportFiles(Array.from(event.target.files ?? []));
  };

  const handleImportDropZoneClick = () => {
    if (isImportBusy) return;
    logInteraction("import-export", "import-picker-opened");
    fileInputRef.current?.click();
  };

  const handleImportDropZoneDragEnter = (event: DragEvent<HTMLElement>) => {
    if (isImportBusy || !hasFileDragPayload(event)) return;
    event.preventDefault();
    setIsImportDropActive(true);
  };

  const handleImportDropZoneDragOver = (event: DragEvent<HTMLElement>) => {
    if (isImportBusy || !hasFileDragPayload(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isImportDropActive) {
      setIsImportDropActive(true);
    }
  };

  const handleImportDropZoneDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!hasFileDragPayload(event)) return;
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    setIsImportDropActive(false);
  };

  const handleImportDropZoneDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasFileDragPayload(event)) return;
    event.preventDefault();
    if (isImportBusy) {
      setIsImportDropActive(false);
      return;
    }
    logInteraction("import-export", "import-files-dropped", {
      fileCount: event.dataTransfer.files.length,
    });
    void handleImportFiles(Array.from(event.dataTransfer.files));
  };

  const handleImport = async () => {
    if (!importPreview) return;
    if (hasBlockingImportIssues) return;
    if (importPreview.notes.length === 0) return;

    logInteraction("import-export", "import-started", {
      noteCount: importPreview.notes.length,
      workbookCount: importPreview.workbooks.length,
    });
    setImportParseError(null);
    setImportSuccessMessage(null);

    const batches = chunkArray(importPreview.notes, IMPORT_BATCH_SIZE);
    setImportProgress({
      processedBatches: 0,
      totalBatches: batches.length,
      importedCount: 0,
    });

    try {
      const importedWorkbookCount = importPreview.workbooks.length;
      const importedNoteCount = importPreview.notes.length;
      let importedCount = 0;
      let duplicateCount = 0;
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const result = await importNotesBatch({
          notes: batch.map((note) => ({
            book: note.book,
            chapter: note.chapter,
            verse: note.verse,
            content: note.content,
            tags: note.tags,
          })),
        });
        const batchDuplicateCount =
          "duplicateCount" in result &&
          typeof result.duplicateCount === "number"
            ? result.duplicateCount
            : 0;

        importedCount += result.importedCount;
        duplicateCount += batchDuplicateCount;
        setImportProgress({
          processedBatches: index + 1,
          totalBatches: batches.length,
          importedCount,
        });
      }

      setImportSuccessMessage(
        `Import complete. Added ${importedCount} of ${importedNoteCount} detected note${importedNoteCount === 1 ? "" : "s"} from ${importedWorkbookCount} workbook${importedWorkbookCount === 1 ? "" : "s"}.${
          duplicateCount > 0
            ? ` Skipped ${duplicateCount} duplicate note${duplicateCount === 1 ? "" : "s"}.`
            : ""
        }`,
      );
      logInteraction("import-export", "import-completed", {
        duplicateCount,
        importedCount,
        workbookCount: importedWorkbookCount,
      });
      resetImportState({ preserveSuccessMessage: true });
    } catch (error) {
      logInteraction("import-export", "import-failed", {
        message: error instanceof Error ? error.message : "unknown-error",
      });
      setImportParseError(
        error instanceof Error ? error.message : "Failed to import notes.",
      );
    } finally {
      setImportProgress(null);
    }
  };

  const handleExport = async () => {
    if (!EXPORT_ENABLED) return;
    if (!exportableNotes) return;

    let exportedBookCount = 0;
    try {
      setExportError(null);
      const notes = exportableNotes;
      const books = getExportBooks(notes, exportScope);
      exportedBookCount = books.length;
      logInteraction("import-export", "export-started", {
        noteCount: notes.length,
        scope: exportScope,
        bookCount: books.length,
      });
      const grouped = groupExportNotesByBook(notes);
      const XLSX = await import("xlsx");
      const { zipSync } = await import("fflate");
      const zipEntries: Record<string, Uint8Array> = {};

      for (let index = 0; index < books.length; index += 1) {
        const book = books[index];
        const bookInfo = BIBLE_BOOKS.find((entry) => entry.name === book);
        if (!bookInfo) continue;

        setExportProgress({
          currentBook: book,
          completedBooks: index,
          totalBooks: books.length,
        });

        const rawChapters = await fetchChaptersTextBatch({
          book,
          chapters: Array.from(
            { length: bookInfo.chapters },
            (_, chapterIndex) => chapterIndex + 1,
          ),
        });

        const workbook = XLSX.utils.book_new();
        const notesByChapter = grouped.get(book);
        for (const chapterResult of rawChapters.sort(
          (a, b) => a.chapter - b.chapter,
        )) {
          const rows = buildChapterExportRows(
            chapterResult.data.verses,
            notesByChapter?.get(chapterResult.chapter),
          );
          const worksheet = XLSX.utils.aoa_to_sheet(rows);
          XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            formatChapterSheetName(chapterResult.chapter),
          );
        }

        const workbookBinary = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
        }) as ArrayBuffer;

        zipEntries[getExportWorkbookName(book)] = new Uint8Array(
          workbookBinary,
        );
      }

      const zipBinary = zipSync(zipEntries);
      const zipBytes = Uint8Array.from(zipBinary);
      const blob = new Blob([zipBytes], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bible-notes-export.zip";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      logInteraction("import-export", "export-completed", {
        bookCount: exportedBookCount,
        scope: exportScope,
      });
    } catch (error) {
      logInteraction("import-export", "export-failed", {
        message: error instanceof Error ? error.message : "unknown-error",
        scope: exportScope,
      });
      setExportError(
        error instanceof Error ? error.message : "Failed to export notes.",
      );
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <Card data-tour-id="settings-import-section">
      <CardHeader>
        <CardTitle>Import / Export</CardTitle>
        <CardDescription>
          Import note workbooks from <InlineCode>.xlsx</InlineCode> or{" "}
          <InlineCode>.zip</InlineCode>, and prepare workbook exports for the
          same format.
        </CardDescription>
        <div className="rounded-md border bg-muted/15 p-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <FileArchive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Import expects one book per file, 1 chapter per tab, and 1 verse
              per row.
            </span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Import notes</h2>
              <p className="text-xs text-muted-foreground">
                Adds notes to the current data. Upload or drag in one or more{" "}
                <InlineCode>.xlsx</InlineCode> workbooks, or a{" "}
                <InlineCode>.zip</InlineCode> that contains{" "}
                <InlineCode>.xlsx</InlineCode> workbooks.
              </p>
            </div>

            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.zip"
              multiple
              onChange={handleFilesSelected}
              disabled={isImportBusy}
              className="sr-only"
            />

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleImportDropZoneClick}
                onDragEnter={handleImportDropZoneDragEnter}
                onDragOver={handleImportDropZoneDragOver}
                onDragLeave={handleImportDropZoneDragLeave}
                onDrop={handleImportDropZoneDrop}
                disabled={isImportBusy}
                className={cn(
                  "w-full rounded-xl border border-dashed px-4 py-8 text-left transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  isImportBusy
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer hover:border-primary/40 hover:bg-muted/20",
                  isImportDropActive && "border-primary bg-primary/5",
                )}
              >
                <div className="pointer-events-none flex flex-col items-center gap-3 text-center">
                  <div
                    className={cn(
                      "rounded-full border p-3 transition-colors",
                      isImportDropActive
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {isImportDropActive
                        ? "Drop files to import"
                        : "Drag and drop note files here"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drop multiple <InlineCode>.xlsx</InlineCode> workbooks or{" "}
                      <InlineCode>.zip</InlineCode> archives, or click here to
                      browse.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {importParseState === "parsing" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing selected files...
              </p>
            )}

            {importParseError && (
              <p className="text-sm text-destructive">{importParseError}</p>
            )}

            {importSuccessMessage && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{importSuccessMessage}</span>
                </p>
              </div>
            )}

            {importPreview && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat
                    label="Books detected"
                    value={String(importPreview.workbooks.length)}
                  />
                  <Stat
                    label="Chapters detected"
                    value={String(importChapterCount)}
                  />
                  <Stat
                    label="Notes detected"
                    value={String(importPreview.notes.length)}
                  />
                  <Stat
                    label="Issues"
                    value={
                      <>
                        <span className="block">{importErrorCount} errors</span>
                        <span className="block">
                          {importWarningCount} warnings
                        </span>
                      </>
                    }
                  />
                </div>

                {importPreview.workbooks.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAreImportWorkbooksExpanded((expanded) => !expanded)
                      }
                      className="flex w-full items-center justify-between rounded-md border bg-muted/15 px-3 py-2 text-left transition-colors hover:bg-muted/30"
                      aria-expanded={areImportWorkbooksExpanded}
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Parsed workbooks
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {importPreview.workbooks.length} workbook
                          {importPreview.workbooks.length === 1 ? "" : "s"}{" "}
                          detected
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {areImportWorkbooksExpanded ? "Hide" : "Show"}
                        {areImportWorkbooksExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                    {areImportWorkbooksExpanded && (
                      <div className="space-y-1">
                        {importPreview.workbooks.map((workbook) => (
                          <div
                            key={workbook.fileName}
                            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
                          >
                            <span className="font-medium">
                              {workbook.fileName}
                            </span>
                            <span className="text-muted-foreground">
                              {workbook.book ?? "Unknown book"}
                            </span>
                            <span className="text-muted-foreground">
                              {workbook.chapterNumbers.length} chapters
                            </span>
                            <span className="text-muted-foreground">
                              {workbook.notes.length} notes
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {importPreview.issues.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Import issues
                    </p>
                    <div className="max-h-56 space-y-3 overflow-auto rounded-md border bg-muted/15 p-2">
                      {importErrors.length > 0 && (
                        <ImportIssueGroup
                          title={`Errors (${importErrorCount})`}
                          issues={importErrors}
                        />
                      )}
                      {importWarnings.length > 0 && (
                        <ImportIssueGroup
                          title={`Warnings (${importWarningCount})`}
                          issues={importWarnings}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void handleImport();
                    }}
                    disabled={
                      importProgress !== null ||
                      importPreview.notes.length === 0 ||
                      hasBlockingImportIssues
                    }
                  >
                    {importProgress ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Import notes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetImportState()}
                    disabled={importProgress !== null}
                  >
                    <X className="h-4 w-4" /> Clear import
                  </Button>
                </div>

                {importProgress && (
                  <p className="text-xs text-muted-foreground">
                    Imported {importProgress.importedCount} notes across batch{" "}
                    {importProgress.processedBatches} of{" "}
                    {importProgress.totalBatches}.
                  </p>
                )}
              </div>
            )}
          </section>

          {EXPORT_ENABLED ? (
            <section className="space-y-3 rounded-lg border bg-background p-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">Export notes</h2>
                <p className="text-xs text-muted-foreground">
                  Generate one workbook per Bible book in a single zip archive.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={
                    exportScope === "booksWithNotes" ? "default" : "outline"
                  }
                  onClick={() => {
                    logInteraction("import-export", "export-scope-changed", {
                      scope: "booksWithNotes",
                    });
                    setExportScope("booksWithNotes");
                  }}
                  disabled={exportProgress !== null}
                >
                  Books with notes
                </Button>
                <Button
                  size="sm"
                  variant={exportScope === "allBooks" ? "default" : "outline"}
                  onClick={() => {
                    logInteraction("import-export", "export-scope-changed", {
                      scope: "allBooks",
                    });
                    setExportScope("allBooks");
                  }}
                  disabled={exportProgress !== null}
                >
                  All 66 books
                </Button>
              </div>

              {exportError && (
                <p className="text-sm text-destructive">{exportError}</p>
              )}

              {exportProgress && (
                <p className="text-xs text-muted-foreground">
                  Preparing {exportProgress.currentBook} (
                  {exportProgress.completedBooks} of {exportProgress.totalBooks}{" "}
                  completed)...
                </p>
              )}

              <Button
                size="sm"
                onClick={() => {
                  void handleExport();
                }}
                disabled={exportProgress !== null}
              >
                {exportProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export workbooks
              </Button>
            </section>
          ) : (
            <section className="flex flex-col items-center justify-center rounded-lg border bg-background p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Export support is coming soon.
              </p>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function ImportIssueRow({ issue }: { issue: ImportIssue }) {
  const isError = issue.severity === "error";

  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2",
        isError
          ? "border-destructive/20 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/10",
      )}
    >
      <div className="flex items-start gap-2">
        <Badge
          variant={isError ? "destructive" : "outline"}
          className={cn(
            "mt-0.5",
            !isError &&
              "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          {isError ? "Error" : "Warning"}
        </Badge>
        <p className="text-xs leading-5 text-foreground">
          <span className="font-medium">{formatIssueLocation(issue)}</span>
          <span>{issue.message}</span>
        </p>
      </div>
    </div>
  );
}

function ImportIssueGroup({
  title,
  issues,
}: {
  title: string;
  issues: ImportIssue[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {issues.map((issue, index) => (
          <ImportIssueRow
            key={`${issue.severity}-${issue.code}-${index}`}
            issue={issue}
          />
        ))}
      </div>
    </div>
  );
}
