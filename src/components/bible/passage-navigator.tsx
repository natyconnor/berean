import { useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { TableOfContents } from "lucide-react";
import { BIBLE_BOOKS, type BookInfo } from "@/lib/bible-books";
import { useTabs } from "@/lib/use-tabs";
import { toPassageId } from "@/lib/verse-ref-utils";
import { cn } from "@/lib/utils";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";

const slideVariants = {
  enterFromRight: { x: 20, opacity: 0 },
  enterFromLeft: { x: -20, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitToLeft: { x: -20, opacity: 0 },
  exitToRight: { x: 20, opacity: 0 },
};

interface PassageNavigatorProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectPassage?: (passageId: string, label: string) => void;
}

export function PassageNavigator({
  trigger,
  open: openProp,
  onOpenChange,
  onSelectPassage,
}: PassageNavigatorProps = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookInfo | null>(null);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [chapterDigits, setChapterDigits] = useState("");
  const open = openProp ?? uncontrolledOpen;
  const { openTab } = useTabs();
  const passageShortcutLabel = formatCommandOrControlShortcut("G");

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

  const highlightedChapter = useMemo(() => {
    if (!selectedBook || !chapterDigits) return null;
    const n = parseInt(chapterDigits, 10);
    if (Number.isNaN(n) || n < 1 || n > selectedBook.chapters) {
      return null;
    }
    return n;
  }, [selectedBook, chapterDigits]);

  const chapterInputInvalid =
    chapterDigits.length > 0 && highlightedChapter === null;

  function selectBook(book: BookInfo) {
    if (book.chapters === 1) {
      selectChapter(book, 1);
    } else {
      setSelectedBook(book);
      setSearch("");
      setChapterDigits("");
    }
  }

  function selectChapter(book: BookInfo, chapter: number) {
    const passageId = toPassageId(book.name, chapter);
    const label = `${book.name} ${chapter}`;
    if (onSelectPassage) {
      onSelectPassage(passageId, label);
    } else {
      openTab(passageId, label);
    }
    handleOpenChange(false);
  }

  function resetState() {
    setSelectedBook(null);
    setSearch("");
    setHighlightedIndex(0);
    setChapterDigits("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (openProp === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <TooltipButton
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            tooltip={`Go to passage (${passageShortcutLabel})`}
          >
            <TableOfContents className="h-4 w-4" />
          </TooltipButton>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-md"
        data-passage-dismiss-exempt
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Go to passage</DialogTitle>
        </DialogHeader>
        <AnimatePresence mode="wait" initial={false}>
          {!selectedBook ? (
            <motion.div
              key="book-list"
              variants={slideVariants}
              initial="enterFromLeft"
              animate="center"
              exit="exitToLeft"
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div className="border-b p-2">
                <Input
                  placeholder="Search books..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const book = filteredBooks[highlightedIndex];
                      if (book) selectBook(book);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIndex((i) =>
                        Math.min(i + 1, filteredBooks.length - 1),
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIndex((i) => Math.max(i - 1, 0));
                    }
                  }}
                />
              </div>
              <ScrollArea className="h-80">
                <div className="p-1">
                  {(["OT", "NT"] as const).map((testament) => {
                    const books = filteredBooks.filter(
                      (b) => b.testament === testament,
                    );
                    if (books.length === 0) return null;
                    return (
                      <div key={testament}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          {testament === "OT"
                            ? "Old Testament"
                            : "New Testament"}
                        </div>
                        {books.map((book) => {
                          const globalIndex = filteredBooks.indexOf(book);
                          return (
                            <button
                              key={book.name}
                              className={cn(
                                "w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors cursor-pointer",
                                globalIndex === highlightedIndex
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted",
                              )}
                              onMouseEnter={() =>
                                setHighlightedIndex(globalIndex)
                              }
                              onClick={() => selectBook(book)}
                            >
                              {book.name}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="chapter-grid"
              variants={slideVariants}
              initial="enterFromRight"
              animate="center"
              exit="exitToRight"
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div className="border-b p-2 space-y-2">
                <button
                  className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  type="button"
                  onClick={() => {
                    setChapterDigits("");
                    setSelectedBook(null);
                  }}
                >
                  &larr; {selectedBook.name}
                </button>
                <div className="space-y-1">
                  <Input
                    placeholder="Chapter number…"
                    value={chapterDigits}
                    onChange={(e) => {
                      setChapterDigits(e.target.value.replace(/\D/g, ""));
                    }}
                    className="h-8"
                    autoFocus
                    aria-label="Chapter number"
                    aria-invalid={chapterInputInvalid}
                    aria-describedby={
                      chapterInputInvalid
                        ? "passage-navigator-chapter-error"
                        : undefined
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (
                          highlightedChapter !== null &&
                          selectedBook !== null
                        ) {
                          selectChapter(selectedBook, highlightedChapter);
                        }
                      }
                    }}
                  />
                  {chapterInputInvalid ? (
                    <p
                      id="passage-navigator-chapter-error"
                      className="text-xs text-destructive"
                      role="alert"
                    >
                      Invalid chapter number for this book.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-6 gap-1">
                  {Array.from(
                    { length: selectedBook.chapters },
                    (_, i) => i + 1,
                  ).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className={cn(
                        "h-9 w-full rounded-sm text-sm font-medium transition-colors cursor-pointer",
                        ch === highlightedChapter
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-primary hover:text-primary-foreground",
                      )}
                      onClick={() => selectChapter(selectedBook, ch)}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
