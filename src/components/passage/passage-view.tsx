import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { useEsvPassage } from "@/hooks/use-esv-passage";
import { usePassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { HighlightRange } from "@/lib/highlight-utils";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabs } from "@/lib/use-tabs";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";
import { cn } from "@/lib/utils";
import { useFocusMode } from "./hooks/use-focus-mode";
import { usePassageViewMode } from "./hooks/use-passage-view-mode";
import { usePassageKeyboardShortcuts } from "./hooks/use-passage-keyboard-shortcuts";
import { usePassageScrollRestoration } from "./hooks/use-passage-scroll-restoration";
import { usePassageViewTour } from "./hooks/use-passage-view-tour";
import { api } from "../../../convex/_generated/api";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import { PassageViewHeader } from "./passage-view-header";
import { PassageViewBody } from "./passage-view-body";
import { PassageViewDialogs } from "./passage-view-dialogs";

interface PassageViewProps {
  book: string;
  chapter: number;
  focusRange?: { startVerse: number; endVerse: number } | null;
  forcedViewMode?: PassageViewMode;
  focusSource?: "search";
}

type PassageViewMode = "compose" | "read";
type NoteVisibility = "all" | "noted";

type VerseItem =
  | {
      kind: "single";
      verseNumber: number;
      text: string;
      singleNotes: NoteWithRef[];
      passageNotes: NoteWithRef[];
    }
  | {
      kind: "passageGroup";
      anchorVerse: number;
      verses: Array<{ verseNumber: number; text: string }>;
      passageNotes: NoteWithRef[];
      singleNotesByVerse: Map<number, NoteWithRef[]>;
    };

export function PassageView({
  book,
  chapter,
  focusRange = null,
  forcedViewMode,
  focusSource,
}: PassageViewProps) {
  const { data, loading, error, retry: retryPassage } = useEsvPassage(
    book,
    chapter,
  );
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>("all");
  const viewportRef = useRef<HTMLDivElement>(null);
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);
  const { effectiveViewMode, isReadMode, setViewMode } =
    usePassageViewMode({
      focusRange,
      forcedViewMode,
      focusSource,
    });
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const { activeTour, startTour, isFocusModeTutorialComplete } = useTutorial();
  const passageNotesInteraction = usePassageNotesInteraction(book, chapter, {
    viewMode: effectiveViewMode,
    setViewMode,
    isFocusMode: !isReadMode && isFocusMode,
  });
  const {
    containerRef,
    expandedPassageRanges,
    singleVerseNotes,
    passageNotesByAnchor,
    openVerseKeys,
    openEditors,
    handleAddNote,
    handleClickAway,
    openVerseNotes,
    showDiscardConfirmation,
    confirmDiscard,
    cancelDiscard,
    setViewModeWithNotesReset,
  } = passageNotesInteraction;

  const handleFocusModeToggle = useCallback(() => {
    const enabling = !isFocusMode;
    toggleFocusMode();
    if (
      enabling &&
      !isReadMode &&
      !isFocusModeTutorialComplete &&
      activeTour !== "main"
    ) {
      startTour("focusMode");
    }
  }, [
    activeTour,
    isFocusMode,
    isFocusModeTutorialComplete,
    isReadMode,
    startTour,
    toggleFocusMode,
  ]);

  const chapterHighlights = useQuery(api.highlights.getForChapter, {
    book,
    chapter,
  });
  const createHighlightMutation = useMutation(api.highlights.create);
  const removeHighlightMutation = useMutation(api.highlights.remove);
  const updateHighlightColorMutation = useMutation(api.highlights.updateColor);

  const [highlightMutationBanner, setHighlightMutationBanner] = useState<
    string | null
  >(null);
  const highlightBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearHighlightMutationBanner = useCallback(() => {
    if (highlightBannerTimeoutRef.current) {
      clearTimeout(highlightBannerTimeoutRef.current);
      highlightBannerTimeoutRef.current = null;
    }
    setHighlightMutationBanner(null);
  }, []);

  const showHighlightMutationError = useCallback(() => {
    if (highlightBannerTimeoutRef.current) {
      clearTimeout(highlightBannerTimeoutRef.current);
    }
    setHighlightMutationBanner("Couldn't update highlight. Try again.");
    highlightBannerTimeoutRef.current = setTimeout(() => {
      setHighlightMutationBanner(null);
      highlightBannerTimeoutRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightBannerTimeoutRef.current) {
        clearTimeout(highlightBannerTimeoutRef.current);
      }
    };
  }, []);

  const highlightsByVerse = useMemo(() => {
    const map = new Map<number, HighlightRange[]>();
    if (!chapterHighlights) return map;
    for (const hl of chapterHighlights) {
      const ranges = map.get(hl.verse) ?? [];
      ranges.push({
        highlightId: hl._id,
        startOffset: hl.startOffset,
        endOffset: hl.endOffset,
        color: hl.color,
        createdAt: hl.createdAt,
      });
      map.set(hl.verse, ranges);
    }
    return map;
  }, [chapterHighlights]);

  const handleCreateHighlight = useCallback(
    (verse: number, startOffset: number, endOffset: number, color: string) => {
      void createHighlightMutation({
        book,
        chapter,
        verse,
        startOffset,
        endOffset,
        color,
      })
        .then(() => clearHighlightMutationBanner())
        .catch(() => showHighlightMutationError());
    },
    [
      book,
      chapter,
      clearHighlightMutationBanner,
      createHighlightMutation,
      showHighlightMutationError,
    ],
  );

  const handleDeleteHighlight = useCallback(
    (highlightId: string) => {
      void removeHighlightMutation({ id: highlightId as Id<"highlights"> })
        .then(() => clearHighlightMutationBanner())
        .catch(() => showHighlightMutationError());
    },
    [
      clearHighlightMutationBanner,
      removeHighlightMutation,
      showHighlightMutationError,
    ],
  );

  const handleRecolorHighlight = useCallback(
    (highlightId: string, color: string) => {
      void updateHighlightColorMutation({
        id: highlightId as Id<"highlights">,
        color,
      })
        .then(() => clearHighlightMutationBanner())
        .catch(() => showHighlightMutationError());
    },
    [
      clearHighlightMutationBanner,
      showHighlightMutationError,
      updateHighlightColorMutation,
    ],
  );

  const { forceAddButtonVisible, displaySingleVerseNotes } = usePassageViewTour(
    {
      book,
      chapter,
      effectiveViewMode,
      setViewMode: setViewModeWithNotesReset,
      singleVerseNotes,
      openVerseKeys,
      openEditors,
      handleClickAway,
      handleAddNote,
      openVerseNotes,
    },
  );

  const hasFocusRange =
    typeof focusRange?.startVerse === "number" &&
    typeof focusRange?.endVerse === "number";

  const noteById = useMemo(() => {
    const map = new Map<Id<"notes">, NoteWithRef>();
    for (const notes of displaySingleVerseNotes.values()) {
      for (const note of notes) {
        map.set(note.noteId, note);
      }
    }
    for (const notes of passageNotesByAnchor.values()) {
      for (const note of notes) {
        map.set(note.noteId, note);
      }
    }
    return map;
  }, [displaySingleVerseNotes, passageNotesByAnchor]);

  const hasAnyNotes = noteById.size > 0;

  const filteredVerses = useMemo((): VerseItem[] => {
    if (!data) return [];

    const mergedVerses = new Set<number>();
    for (const range of expandedPassageRanges) {
      for (let v = range.startVerse; v <= range.endVerse; v++) {
        mergedVerses.add(v);
      }
    }

    const items: VerseItem[] = [];

    for (const verse of data.verses) {
      if (mergedVerses.has(verse.number)) {
        const range = expandedPassageRanges.find(
          (r) => r.anchorVerse === verse.number,
        );
        if (range) {
          const blockVerses = data.verses
            .filter(
              (v) => v.number >= range.startVerse && v.number <= range.endVerse,
            )
            .map((v) => ({ verseNumber: v.number, text: v.text }));
          const singleNotesByVerse = new Map<number, NoteWithRef[]>();
          for (const v of blockVerses) {
            const notes = displaySingleVerseNotes.get(v.verseNumber);
            if (notes && notes.length > 0)
              singleNotesByVerse.set(v.verseNumber, notes);
          }
          items.push({
            kind: "passageGroup",
            anchorVerse: range.anchorVerse,
            verses: blockVerses,
            passageNotes: passageNotesByAnchor.get(range.anchorVerse) ?? [],
            singleNotesByVerse,
          });
        }
        continue;
      }

      const singleNotes = displaySingleVerseNotes.get(verse.number) ?? [];
      const passageNotes = passageNotesByAnchor.get(verse.number) ?? [];
      const hasVisibleNotes = singleNotes.length > 0 || passageNotes.length > 0;
      if (
        isReadMode &&
        !hasFocusRange &&
        noteVisibility === "noted" &&
        hasAnyNotes &&
        !hasVisibleNotes
      ) {
        continue;
      }

      items.push({
        kind: "single",
        verseNumber: verse.number,
        text: verse.text,
        singleNotes,
        passageNotes,
      });
    }

    return items;
  }, [
    data,
    expandedPassageRanges,
    hasAnyNotes,
    hasFocusRange,
    isReadMode,
    passageNotesByAnchor,
    noteVisibility,
    displaySingleVerseNotes,
  ]);

  const currentGroupedVerses = useMemo(() => {
    const set = new Set<number>();
    for (const range of expandedPassageRanges) {
      for (let v = range.startVerse; v <= range.endVerse; v++) {
        set.add(v);
      }
    }
    return set;
  }, [expandedPassageRanges]);

  const [previousGroupedVerses, setPreviousGroupedVerses] = useState(
    () => new Set<number>(),
  );
  const reenteringFromGroup = useMemo(() => {
    const set = new Set<number>();
    for (const v of previousGroupedVerses) {
      if (!currentGroupedVerses.has(v)) {
        set.add(v);
      }
    }
    return set;
  }, [currentGroupedVerses, previousGroupedVerses]);

  useEffect(() => {
    setPreviousGroupedVerses(currentGroupedVerses);
  }, [currentGroupedVerses]);

  const passageGridClass = isReadMode
    ? "grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6"
    : "grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5";
  const topGridClass = cn("grid", passageGridClass);
  const containerClass = isReadMode
    ? "max-w-[1400px] mx-auto px-6 pb-16"
    : "max-w-[1320px] mx-auto px-5 pb-16";
  const focusStartVerse = focusRange?.startVerse;
  const focusEndVerse = focusRange?.endVerse;
  const focusRequestKey = hasFocusRange
    ? `${book}|${chapter}|${focusStartVerse}|${focusEndVerse}`
    : null;
  const focusLayoutKey = focusRequestKey
    ? `${focusRequestKey}|${noteById.size}`
    : null;

  usePassageKeyboardShortcuts({
    previous,
    next,
    navigateActiveTab,
    setViewMode: setViewModeWithNotesReset,
    onToggleFocusMode: handleFocusModeToggle,
  });

  const { isScrolled } = usePassageScrollRestoration({
    book,
    chapter,
    focusStartVerse,
    focusRequestKey,
    focusLayoutKey,
    hasData: !!data,
    containerRef,
    viewportRef,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="max-w-md space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">
            Couldn&apos;t load this chapter
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button
            type="button"
            size="sm"
            className="mt-1"
            onClick={() => retryPassage()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const passageKey = `${book}-${chapter}`;

  const headerInnerClass = isReadMode
    ? "max-w-[1400px] mx-auto px-6"
    : "max-w-[1320px] mx-auto px-5";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {highlightMutationBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
        >
          {highlightMutationBanner}
        </div>
      ) : null}
      <PassageViewHeader
        book={book}
        chapter={chapter}
        isScrolled={isScrolled}
        passageGridClass={passageGridClass}
        headerInnerClass={headerInnerClass}
        effectiveViewMode={effectiveViewMode}
        isReadMode={isReadMode}
        isFocusMode={isFocusMode}
        hasAnyNotes={hasAnyNotes}
        noteVisibility={noteVisibility}
        setViewModeWithNotesReset={setViewModeWithNotesReset}
        setNoteVisibility={setNoteVisibility}
        onToggleFocusMode={handleFocusModeToggle}
      />

      <PassageViewBody
        book={book}
        chapter={chapter}
        dataCopyright={data.copyright}
        passageKey={passageKey}
        containerClass={containerClass}
        topGridClass={topGridClass}
        viewportRef={viewportRef}
        filteredVerses={filteredVerses}
        passageNotesInteraction={passageNotesInteraction}
        effectiveViewMode={effectiveViewMode}
        isFocusMode={!isReadMode && isFocusMode}
        hasFocusRange={hasFocusRange}
        focusRange={focusRange}
        reenteringFromGroup={reenteringFromGroup}
        highlightsByVerse={highlightsByVerse}
        forceAddButtonVisible={forceAddButtonVisible}
        onCreateHighlight={handleCreateHighlight}
        onDeleteHighlight={handleDeleteHighlight}
        onRecolorHighlight={handleRecolorHighlight}
      />

      <PassageViewDialogs
        showDiscardConfirmation={showDiscardConfirmation}
        cancelDiscard={cancelDiscard}
        confirmDiscard={confirmDiscard}
      />
    </div>
  );
}
