import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { BIBLE_BOOKS, type BookInfo } from "@/lib/bible-books";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ChapterRange {
  start: number;
  end: number;
}

interface StudyScopeBookPickerProps {
  selectedBooks: string[];
  chapterRanges: Map<string, ChapterRange>;
  onToggleBook: (bookName: string) => void;
  onSetBooks: (books: string[]) => void;
  onSetChapterRange: (book: string, range: ChapterRange | null) => void;
}

export function StudyScopeBookPicker({
  selectedBooks,
  chapterRanges,
  onToggleBook,
  onSetChapterRange,
}: StudyScopeBookPickerProps) {
  const [search, setSearch] = useState("");
  const [editingRangeBook, setEditingRangeBook] = useState<string | null>(null);

  const filteredBooks = useMemo(
    () =>
      search
        ? BIBLE_BOOKS.filter(
            (b) =>
              b.name.toLowerCase().includes(search.toLowerCase()) ||
              b.abbreviation.toLowerCase().includes(search.toLowerCase()),
          )
        : BIBLE_BOOKS,
    [search],
  );

  const selectedSet = useMemo(() => new Set(selectedBooks), [selectedBooks]);

  const singleBook =
    selectedBooks.length === 1
      ? BIBLE_BOOKS.find((b) => b.name === selectedBooks[0])
      : null;

  const showChapterGrid = singleBook && singleBook.chapters > 1;

  return (
    <div className="space-y-3">
      {selectedBooks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedBooks.map((bookName) => {
            const range = chapterRanges.get(bookName);
            const info = BIBLE_BOOKS.find((b) => b.name === bookName);
            const label = range
              ? range.start === range.end
                ? `${bookName} ${range.start}`
                : `${bookName} ${range.start}\u2013${range.end}`
              : bookName;

            return (
              <Badge
                key={bookName}
                variant="outline"
                className={cn(
                  "gap-1",
                  !showChapterGrid &&
                    info &&
                    info.chapters > 1 &&
                    "cursor-pointer",
                )}
                onClick={() => {
                  if (!showChapterGrid && info && info.chapters > 1) {
                    setEditingRangeBook(
                      editingRangeBook === bookName ? null : bookName,
                    );
                  }
                }}
              >
                {label}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBook(bookName);
                        onSetChapterRange(bookName, null);
                        if (editingRangeBook === bookName) {
                          setEditingRangeBook(null);
                        }
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Remove {bookName}</TooltipContent>
                </Tooltip>
              </Badge>
            );
          })}
        </div>
      )}

      {editingRangeBook && !showChapterGrid && (
        <ChapterRangeEditor
          bookName={editingRangeBook}
          bookInfo={BIBLE_BOOKS.find((b) => b.name === editingRangeBook)!}
          range={chapterRanges.get(editingRangeBook) ?? null}
          onSetRange={(range) => onSetChapterRange(editingRangeBook, range)}
          onClose={() => setEditingRangeBook(null)}
        />
      )}

      <Input
        placeholder="Search books..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8"
      />

      <ScrollArea className="h-56">
        <div className="space-y-0.5 pr-3">
          {(["OT", "NT"] as const).map((testament) => {
            const books = filteredBooks.filter(
              (b) => b.testament === testament,
            );
            if (books.length === 0) return null;
            return (
              <div key={testament}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {testament === "OT" ? "Old Testament" : "New Testament"}
                </div>
                {books.map((book) => (
                  <BookRow
                    key={book.name}
                    book={book}
                    selected={selectedSet.has(book.name)}
                    onToggle={() => onToggleBook(book.name)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {showChapterGrid && (
        <ChapterGrid
          bookInfo={singleBook}
          range={chapterRanges.get(singleBook.name) ?? null}
          onSetRange={(range) => onSetChapterRange(singleBook.name, range)}
        />
      )}
    </div>
  );
}

function BookRow({
  book,
  selected,
  onToggle,
}: {
  book: BookInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm transition-colors cursor-pointer",
        selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
      )}
      onClick={onToggle}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30",
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1 text-left">{book.name}</span>
      <span className="text-xs text-muted-foreground">{book.chapters} ch</span>
    </button>
  );
}

function ChapterGrid({
  bookInfo,
  range,
  onSetRange,
}: {
  bookInfo: BookInfo;
  range: ChapterRange | null;
  onSetRange: (range: ChapterRange | null) => void;
}) {
  const [hoveredChapter, setHoveredChapter] = useState<number | null>(null);

  const isAllSelected = range === null;
  const isSingleChapter = range !== null && range.start === range.end;
  const anchor = isSingleChapter ? range.start : null;

  const previewRange =
    anchor !== null && hoveredChapter !== null && hoveredChapter !== anchor
      ? {
          start: Math.min(anchor, hoveredChapter),
          end: Math.max(anchor, hoveredChapter),
        }
      : null;

  function handleChapterClick(ch: number) {
    if (isAllSelected) {
      onSetRange({ start: ch, end: ch });
      return;
    }

    if (isSingleChapter) {
      if (ch === range.start) {
        onSetRange(null);
      } else {
        const start = Math.min(range.start, ch);
        const end = Math.max(range.start, ch);
        onSetRange({ start, end });
      }
      return;
    }

    // Multi-chapter range
    if (ch >= range.start && ch <= range.end) {
      onSetRange({ start: ch, end: ch });
    } else {
      const distToStart = Math.abs(ch - range.start);
      const distToEnd = Math.abs(ch - range.end);
      if (distToStart <= distToEnd) {
        onSetRange({ start: Math.min(ch, range.start), end: range.end });
      } else {
        onSetRange({ start: range.start, end: Math.max(ch, range.end) });
      }
    }
  }

  function getCellStyle(ch: number): string {
    if (isAllSelected) {
      return "bg-primary text-primary-foreground";
    }

    if (previewRange && ch >= previewRange.start && ch <= previewRange.end) {
      if (ch === anchor) {
        return "bg-primary text-primary-foreground ring-2 ring-primary/50";
      }
      return "bg-primary/20 text-primary";
    }

    if (range && ch >= range.start && ch <= range.end) {
      if (ch === anchor) {
        return "bg-primary text-primary-foreground ring-2 ring-primary/50";
      }
      return "bg-primary text-primary-foreground";
    }

    return "bg-background hover:bg-primary/10 hover:text-primary";
  }

  const rangeLabel = isAllSelected
    ? `All ${bookInfo.chapters} chapters`
    : isSingleChapter
      ? `Chapter ${range.start}`
      : `Chapters ${range.start}\u2013${range.end}`;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">
          {bookInfo.name} &middot; {rangeLabel}
        </p>
        {!isAllSelected && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => onSetRange(null)}
          >
            Clear selection
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {isAllSelected
          ? "Click a chapter to narrow the scope, or two to pick a range"
          : isSingleChapter
            ? "Click another chapter to select a range, or click again to deselect"
            : "Click inside the range to narrow, or outside to expand it"}
      </p>
      <div
        className="grid grid-cols-8 gap-1"
        onMouseLeave={() => setHoveredChapter(null)}
      >
        {Array.from({ length: bookInfo.chapters }, (_, i) => i + 1).map(
          (ch) => (
            <button
              key={ch}
              type="button"
              className={cn(
                "h-8 w-full rounded-sm text-xs font-medium transition-colors cursor-pointer",
                getCellStyle(ch),
              )}
              onClick={() => handleChapterClick(ch)}
              onMouseEnter={() => setHoveredChapter(ch)}
            >
              {ch}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function ChapterRangeEditor({
  bookName,
  bookInfo,
  range,
  onSetRange,
  onClose,
}: {
  bookName: string;
  bookInfo: BookInfo;
  range: ChapterRange | null;
  onSetRange: (range: ChapterRange | null) => void;
  onClose: () => void;
}) {
  const [startStr, setStartStr] = useState(range ? String(range.start) : "");
  const [endStr, setEndStr] = useState(range ? String(range.end) : "");

  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  const isValid =
    !Number.isNaN(start) &&
    !Number.isNaN(end) &&
    start >= 1 &&
    end >= start &&
    end <= bookInfo.chapters;

  function handleApply() {
    if (isValid) {
      if (start === 1 && end === bookInfo.chapters) {
        onSetRange(null);
      } else {
        onSetRange({ start, end });
      }
      onClose();
    }
  }

  function handleClear() {
    onSetRange(null);
    onClose();
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">
          {bookName} chapters (1\u2013{bookInfo.chapters})
        </p>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={handleClear}
        >
          All chapters
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={bookInfo.chapters}
          placeholder="Start"
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
          className="h-7 w-20 text-sm"
          autoFocus
        />
        <span className="text-xs text-muted-foreground">&ndash;</span>
        <Input
          type="number"
          min={1}
          max={bookInfo.chapters}
          placeholder="End"
          value={endStr}
          onChange={(e) => setEndStr(e.target.value)}
          className="h-7 w-20 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
        />
        <button
          type="button"
          className={cn(
            "text-xs font-medium px-2 py-1 rounded",
            isValid
              ? "text-primary hover:bg-primary/10 cursor-pointer"
              : "text-muted-foreground cursor-not-allowed",
          )}
          disabled={!isValid}
          onClick={handleApply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
