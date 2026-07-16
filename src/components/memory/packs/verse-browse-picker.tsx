import { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BIBLE_BOOKS, type BookInfo } from "@/lib/bible-books";
import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import type { VerseScope } from "@/lib/verse-scope-match";
import { cn } from "@/lib/utils";

function getAllowedChapterRange(
  book: BookInfo,
  scope?: VerseScope,
): { start: number; end: number } {
  if (!scope || scope.books.length === 0 || !scope.books.includes(book.name)) {
    return { start: 1, end: book.chapters };
  }
  const range = scope.chapterRanges?.find((r) => r.book === book.name);
  if (!range) return { start: 1, end: book.chapters };
  return {
    start: Math.max(1, range.startChapter),
    end: Math.min(book.chapters, range.endChapter),
  };
}

export interface BrowseVerse {
  verseRefId?: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

interface VerseRange {
  start: number;
  end: number;
}

interface VerseBrowsePickerProps {
  scope?: VerseScope;
  isSelected: (verse: BrowseVerse) => boolean;
  isDisabled?: (verse: BrowseVerse) => boolean;
  isPending?: (verse: BrowseVerse) => boolean;
  onSelect: (verse: BrowseVerse) => void;
}

export function VerseBrowsePicker({
  scope,
  isSelected,
  isDisabled,
  isPending,
  onSelect,
}: VerseBrowsePickerProps) {
  const [search, setSearch] = useState("");
  const [selectedBook, setSelectedBook] = useState<BookInfo | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);

  const scopedBooks = useMemo(
    () =>
      scope && scope.books.length > 0
        ? BIBLE_BOOKS.filter((book) => scope.books.includes(book.name))
        : BIBLE_BOOKS,
    [scope],
  );

  const filteredBooks = useMemo(
    () =>
      search
        ? scopedBooks.filter(
            (book) =>
              book.name.toLowerCase().includes(search.toLowerCase()) ||
              book.abbreviation.toLowerCase().includes(search.toLowerCase()),
          )
        : scopedBooks,
    [search, scopedBooks],
  );

  const selectedBookRange = selectedBook
    ? getAllowedChapterRange(selectedBook, scope)
    : null;
  const verseCount =
    selectedBook && selectedChapter
      ? getChapterVerseCount(selectedBook.name, selectedChapter)
      : null;

  if (!selectedBook) {
    return (
      <div className="space-y-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search books…"
          className="h-9"
          aria-label="Search Bible books"
        />
        <ScrollArea className="h-56 rounded-lg border">
          <div className="p-1.5">
            {(["OT", "NT"] as const).map((testament) => {
              const books = filteredBooks.filter(
                (book) => book.testament === testament,
              );
              if (books.length === 0) return null;
              return (
                <div key={testament}>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {testament === "OT" ? "Old Testament" : "New Testament"}
                  </div>
                  {books.map((book) => (
                    <button
                      key={book.name}
                      type="button"
                      onClick={() => {
                        const range = getAllowedChapterRange(book, scope);
                        setSelectedBook(book);
                        setSelectedChapter(
                          range.start === range.end ? range.start : null,
                        );
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <span>{book.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {book.chapters} ch
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!selectedChapter) {
    return (
      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 text-muted-foreground"
          onClick={() => setSelectedBook(null)}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {selectedBook.name}
        </Button>
        <div className="grid grid-cols-6 gap-1">
          {Array.from(
            {
              length:
                (selectedBookRange?.end ?? selectedBook.chapters) -
                (selectedBookRange?.start ?? 1) +
                1,
            },
            (_, index) => (selectedBookRange?.start ?? 1) + index,
          ).map((chapter) => {
            return (
              <button
                key={chapter}
                type="button"
                onClick={() => setSelectedChapter(chapter)}
                className="h-9 rounded-md bg-muted text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {chapter}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1.5 text-muted-foreground"
        onClick={() => setSelectedChapter(null)}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {selectedBook.name} {selectedChapter}
      </Button>
      {verseCount === null ? (
        <p className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">
          Verse counts are unavailable for this chapter.
        </p>
      ) : (
        <VerseRangeGrid
          book={selectedBook.name}
          chapter={selectedChapter}
          verseCount={verseCount}
          isSelected={isSelected}
          isDisabled={isDisabled}
          isPending={isPending}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function VerseRangeGrid({
  book,
  chapter,
  verseCount,
  isSelected,
  isDisabled,
  isPending,
  onSelect,
}: {
  book: string;
  chapter: number;
  verseCount: number;
  isSelected: (verse: BrowseVerse) => boolean;
  isDisabled?: (verse: BrowseVerse) => boolean;
  isPending?: (verse: BrowseVerse) => boolean;
  onSelect: (verse: BrowseVerse) => void;
}) {
  const [range, setRange] = useState<VerseRange | null>(null);
  const [hoveredVerse, setHoveredVerse] = useState<number | null>(null);

  const isSingle = range !== null && range.start === range.end;
  const anchor = isSingle ? range.start : null;

  const previewRange =
    anchor !== null && hoveredVerse !== null && hoveredVerse !== anchor
      ? {
          start: Math.min(anchor, hoveredVerse),
          end: Math.max(anchor, hoveredVerse),
        }
      : null;

  const span: BrowseVerse | null = range
    ? { book, chapter, startVerse: range.start, endVerse: range.end }
    : null;
  const spanSelected = span ? isSelected(span) : false;
  const spanDisabled = span ? (isDisabled?.(span) ?? false) : false;
  const spanPending = span ? (isPending?.(span) ?? false) : false;

  function handleVerseClick(verse: number) {
    if (range === null) {
      setRange({ start: verse, end: verse });
      return;
    }
    if (isSingle) {
      if (verse === range.start) {
        setRange(null);
      } else {
        setRange({
          start: Math.min(range.start, verse),
          end: Math.max(range.start, verse),
        });
      }
      return;
    }
    // Multi-verse range: click inside narrows, click outside expands.
    if (verse >= range.start && verse <= range.end) {
      setRange({ start: verse, end: verse });
    } else if (Math.abs(verse - range.start) <= Math.abs(verse - range.end)) {
      setRange({ start: Math.min(verse, range.start), end: range.end });
    } else {
      setRange({ start: range.start, end: Math.max(verse, range.end) });
    }
  }

  function getCellStyle(verse: number): string {
    if (
      previewRange &&
      verse >= previewRange.start &&
      verse <= previewRange.end
    ) {
      if (verse === anchor) {
        return "bg-primary text-primary-foreground ring-2 ring-primary/50";
      }
      return "bg-primary/20 text-primary";
    }
    if (range && verse >= range.start && verse <= range.end) {
      if (verse === anchor) {
        return "bg-primary text-primary-foreground ring-2 ring-primary/50";
      }
      return "bg-primary text-primary-foreground";
    }
    return "bg-muted hover:bg-primary/10 hover:text-primary";
  }

  function handleAdd() {
    if (!span || spanDisabled || spanPending || spanSelected) return;
    onSelect(span);
    setRange(null);
    setHoveredVerse(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {range === null
          ? "Tap a verse, then tap another to select a range."
          : isSingle
            ? "Tap another verse to make a range, or tap it again to clear."
            : "Tap inside the range to narrow, or outside to expand."}
      </p>
      <ScrollArea className="h-48 rounded-lg border">
        <div
          className="grid grid-cols-6 gap-1.5 p-2"
          onMouseLeave={() => setHoveredVerse(null)}
        >
          {Array.from({ length: verseCount }, (_, index) => {
            const verse = index + 1;
            return (
              <button
                key={verse}
                type="button"
                onClick={() => handleVerseClick(verse)}
                onMouseEnter={() => setHoveredVerse(verse)}
                aria-label={`Verse ${verse}`}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors",
                  getCellStyle(verse),
                )}
              >
                {verse}
              </button>
            );
          })}
        </div>
      </ScrollArea>
      {span ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium">
            {formatVerseRef(span)}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={() => {
                setRange(null);
                setHoveredVerse(null);
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={spanDisabled || spanPending || spanSelected}
              onClick={handleAdd}
            >
              {spanPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : spanSelected ? (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" aria-hidden />
                  Added
                </span>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
