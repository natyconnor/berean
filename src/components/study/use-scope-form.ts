import { useCallback, useMemo, useState } from "react";

import type { TagMatchMode } from "@/lib/tag-utils";

import type { ChapterRange } from "./study-scope-book-picker";
import { formatScopeSummary, type StudyScope } from "./study-scope-summary";

/** The scope value in the shape `previewCounts`/`previewScopeCount` expect. */
export interface ScopeForPreview {
  books: string[];
  chapterRanges: Array<{
    book: string;
    startChapter: number;
    endChapter: number;
  }>;
  tags: string[];
  tagMatchMode: TagMatchMode;
}

/** The controlled state + handlers a `ScopeForm` renders. */
export interface ScopeFormControls {
  selectedBooks: string[];
  chapterRanges: Map<string, ChapterRange>;
  selectedTags: string[];
  tagMatchMode: TagMatchMode;
  onToggleBook: (bookName: string) => void;
  onSetBooks: (books: string[]) => void;
  onSetChapterRange: (book: string, range: ChapterRange | null) => void;
  onSelectPreset: (books: string[]) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onSetTagMatchMode: (mode: TagMatchMode) => void;
}

export interface UseScopeFormResult extends ScopeFormControls {
  /** The live scope, shaped for persistence (`scope` on sessions/packs). */
  scope: StudyScope;
  /** The scope shaped for the preview queries (empty array, not `undefined`). */
  scopeForPreview: ScopeForPreview;
  /** Human summary used as a default name / footer label. */
  summaryText: string;
  /**
   * Pack builder: false while no book is listed. Missing chapter ranges still
   * mean the whole book. Study always reports true.
   */
  isComplete: boolean;
}

export interface UseScopeFormOptions {
  /**
   * Pack builder mode: at least one book must be listed before create/continue.
   * A listed multi-chapter book with no range still means the whole book
   * (same matching rules as Study). Study leaves this off.
   */
  requireChapterSelection?: boolean;
}

/**
 * Owns the passage-scope + tag selection state shared by the Study session
 * builder and the Memory scope-pack builder. Kept UI-free so both surfaces can
 * render their own chrome (header/footer/preview) around a `ScopeForm`.
 */
export function useScopeForm(
  options: UseScopeFormOptions = {},
): UseScopeFormResult {
  const requireChapterSelection = options.requireChapterSelection === true;
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [chapterRanges, setChapterRanges] = useState<Map<string, ChapterRange>>(
    new Map(),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>("any");

  const scope: StudyScope = useMemo(
    () => ({
      books: selectedBooks,
      chapterRanges:
        chapterRanges.size > 0
          ? Array.from(chapterRanges.entries()).map(([book, r]) => ({
              book,
              startChapter: r.start,
              endChapter: r.end,
            }))
          : undefined,
      tags: selectedTags,
      tagMatchMode,
    }),
    [selectedBooks, chapterRanges, selectedTags, tagMatchMode],
  );

  const scopeForPreview = useMemo<ScopeForPreview>(
    () => ({
      books: scope.books,
      chapterRanges: scope.chapterRanges ?? [],
      tags: scope.tags,
      tagMatchMode: scope.tagMatchMode,
    }),
    [scope],
  );

  const summaryText = formatScopeSummary(scope);

  const isComplete = useMemo(() => {
    if (!requireChapterSelection) return true;
    // Blank builder is incomplete. Missing chapter ranges still mean the whole
    // book, so listing books is enough to continue/create.
    return selectedBooks.length > 0;
  }, [requireChapterSelection, selectedBooks]);

  const onToggleBook = useCallback(
    (bookName: string) => {
      const removing = selectedBooks.includes(bookName);
      setSelectedBooks((prev) =>
        removing ? prev.filter((b) => b !== bookName) : [...prev, bookName],
      );
      if (!removing) return;
      setChapterRanges((ranges) => {
        if (!ranges.has(bookName)) return ranges;
        const next = new Map(ranges);
        next.delete(bookName);
        return next;
      });
    },
    [selectedBooks],
  );

  const onSetBooks = useCallback((books: string[]) => {
    setSelectedBooks(books);
    setChapterRanges(new Map());
  }, []);

  const onSetChapterRange = useCallback(
    (book: string, range: ChapterRange | null) => {
      setChapterRanges((prev) => {
        const next = new Map(prev);
        if (range) {
          next.set(book, range);
        } else {
          next.delete(book);
        }
        return next;
      });
    },
    [],
  );

  const onSelectPreset = useCallback((books: string[]) => {
    setSelectedBooks(books);
    // Empty ranges mean each listed book in full — same as a fresh book toggle.
    setChapterRanges(new Map());
  }, []);

  const onToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const onClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const onSetTagMatchMode = useCallback((mode: TagMatchMode) => {
    setTagMatchMode(mode);
  }, []);

  return {
    selectedBooks,
    chapterRanges,
    selectedTags,
    tagMatchMode,
    onToggleBook,
    onSetBooks,
    onSetChapterRange,
    onSelectPreset,
    onToggleTag,
    onClearTags,
    onSetTagMatchMode,
    scope,
    scopeForPreview,
    summaryText,
    isComplete,
  };
}
