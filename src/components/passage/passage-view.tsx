import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEsvPassage } from "@/hooks/use-esv-passage";
import { ChapterHeader } from "@/components/bible/chapter-header";
import { ChapterPager } from "@/components/bible/chapter-pager";
import { CopyrightNotice } from "@/components/bible/copyright-notice";
import { GospelParallelBanner } from "@/components/links/gospel-parallel-banner";
import { VerseRowWithNotes } from "./view/verse-row-with-notes";
import { usePassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import { NoteEditor } from "@/components/notes/note-editor";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { BookOpen, Loader2, Pencil } from "lucide-react";
import { useTabs } from "@/lib/use-tabs";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";
import { cn } from "@/lib/utils";

interface PassageViewProps {
  book: string;
  chapter: number;
  focusRange?: { startVerse: number; endVerse: number } | null;
  forcedViewMode?: PassageViewMode;
  focusSource?: "search";
}

type PassageViewMode = "compose" | "read";

const READING_MODE_STORAGE_KEY = "bible-notes-passage-view-mode";

function resolveInitialViewMode(): PassageViewMode {
  try {
    const saved = localStorage.getItem(READING_MODE_STORAGE_KEY);
    if (saved === "compose" || saved === "read") {
      return saved;
    }
  } catch {
    // localStorage unavailable
  }
  return "compose";
}


export function PassageView({
  book,
  chapter,
  focusRange = null,
  forcedViewMode,
  focusSource,
}: PassageViewProps) {
  const { data, loading, error } = useEsvPassage(book, chapter);
  const handledFocusRequestRef = useRef<string | null>(null);
  const [searchModeLock, setSearchModeLock] = useState<boolean>(
    () => focusSource === "search" && forcedViewMode === "read" && !!focusRange
  );
  const [viewMode, setViewModeState] = useState<PassageViewMode>(
    () =>
      focusSource === "search" && forcedViewMode === "read"
        ? "read"
        : resolveInitialViewMode()
  );
  const [showOnlyWithNotes, setShowOnlyWithNotes] = useState(false);
  const [activeTag, setActiveTag] = useState("all");
  const [isScrolled, setIsScrolled] = useState(false);
  const passageWrapperRef = useRef<HTMLDivElement>(null);
  const savedScrollPositions = useRef(new Map<string, number>());
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);
  const {
    containerRef,
    selectedVerses,
    isInSelection,
    isPassageSelection,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    hoveredVerse,
    hoveredPassageBubble,
    hoveredSingleBubble,
    openVerseKey,
    openPassageKey,
    creatingFor,
    editingNoteId,
    handleAddNote,
    handleVerseMouseDown,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseUp,
    handleSingleBubbleMouseEnter,
    handleSingleBubbleMouseLeave,
    handlePassageBubbleMouseEnter,
    handlePassageBubbleMouseLeave,
    openVerseNotes,
    openPassageNotes,
    startEditingNote,
    cancelEditing,
    handleDelete,
    handleSaveEdit,
    handleSaveNew,
    handleClickAway,
    startCreatingPassageNote,
  } = usePassageNotesInteraction(book, chapter);

  const setViewMode = useCallback((next: PassageViewMode) => {
    setSearchModeLock(false);
    setViewModeState(next);
    try {
      localStorage.setItem(READING_MODE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const isFocusNavigation =
    searchModeLock &&
    focusSource === "search" &&
    forcedViewMode === "read" &&
    !!focusRange;
  const effectiveViewMode: PassageViewMode = isFocusNavigation ? "read" : viewMode;
  const isReadMode = effectiveViewMode === "read";
  const editorMode = isReadMode ? "dialog" : "inline";

  const noteById = useMemo(() => {
    const map = new Map<Id<"notes">, NoteWithRef>();
    for (const notes of singleVerseNotes.values()) {
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
  }, [singleVerseNotes, passageNotesByAnchor]);

  const editingNote = editingNoteId
    ? noteById.get(editingNoteId) ?? null
    : null;

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const note of noteById.values()) {
      for (const tag of note.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [noteById]);

  const filteredVerses = useMemo(() => {
    if (!data) return [];

    return data.verses.flatMap((verse) => {
      const singleNotes = singleVerseNotes.get(verse.number) ?? [];
      const passageNotes = passageNotesByAnchor.get(verse.number) ?? [];

      const singleVisible =
        isReadMode && !isFocusNavigation && activeTag !== "all"
          ? singleNotes.filter((note) => note.tags.includes(activeTag))
          : singleNotes;

      const passageVisible =
        isReadMode && !isFocusNavigation && activeTag !== "all"
          ? passageNotes.filter((note) => note.tags.includes(activeTag))
          : passageNotes;

      const hasVisibleNotes =
        singleVisible.length > 0 || passageVisible.length > 0;
      if (isReadMode && !isFocusNavigation && showOnlyWithNotes && !hasVisibleNotes) {
        return [];
      }

      return [
        {
          verseNumber: verse.number,
          text: verse.text,
          singleNotes: singleVisible,
          passageNotes: passageVisible,
        },
      ];
    });
  }, [
    activeTag,
    data,
    isFocusNavigation,
    isReadMode,
    passageNotesByAnchor,
    showOnlyWithNotes,
    singleVerseNotes,
  ]);

  const shouldShowQuickCaptureDialog =
    isReadMode && (!!creatingFor || !!editingNote);
  const passageGridClass = isReadMode
    ? "grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6"
    : "grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5";
  const topGridClass = cn("grid", passageGridClass);
  const containerClass = isReadMode
    ? "max-w-[1400px] mx-auto px-6 pb-16"
    : "max-w-[1320px] mx-auto px-5 pb-16";
  const focusStartVerse = focusRange?.startVerse;
  const focusEndVerse = focusRange?.endVerse;
  const focusRequestKey =
    isFocusNavigation &&
    typeof focusStartVerse === "number" &&
    typeof focusEndVerse === "number"
      ? `${book}|${chapter}|${focusStartVerse}|${focusEndVerse}`
      : null;

  useEffect(() => {
    if (!focusRequestKey) {
      handledFocusRequestRef.current = null;
      return;
    }
    if (!data || effectiveViewMode !== "read") return;
    if (handledFocusRequestRef.current === focusRequestKey) return;

    let attempts = 0;
    const maxAttempts = 30;

    const scrollToTarget = () => {
      const selector = `[data-verse-number="${focusStartVerse}"]`;
      const target =
        containerRef.current?.querySelector<HTMLElement>(selector) ??
        document.querySelector<HTMLElement>(selector);
      if (!target) return false;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      handledFocusRequestRef.current = focusRequestKey;
      return true;
    };

    if (!scrollToTarget()) {
      const intervalId = window.setInterval(() => {
        attempts += 1;
        if (scrollToTarget() || attempts >= maxAttempts) {
          window.clearInterval(intervalId);
        }
      }, 100);
      return () => {
        window.clearInterval(intervalId);
      };
    }
  }, [
    book,
    chapter,
    containerRef,
    data,
    effectiveViewMode,
    focusRequestKey,
    focusStartVerse,
  ]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

      e.preventDefault();
      if (e.key === "ArrowLeft" && previous) {
        navigateActiveTab(previous.passageId, previous.label);
      } else if (e.key === "ArrowRight" && next) {
        navigateActiveTab(next.passageId, next.label);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [previous, next, navigateActiveTab]);

  // Save scroll position before navigating away from the current passage
  useEffect(() => {
    const key = `${book}-${chapter}`;
    return () => {
      const viewport = passageWrapperRef.current?.querySelector<HTMLElement>(
        "[data-slot='scroll-area-viewport']"
      );
      if (viewport) {
        savedScrollPositions.current.set(key, viewport.scrollTop);
      }
    };
  }, [book, chapter]);

  // Restore saved scroll position when returning to a passage, or jump to top for new navigation
  useEffect(() => {
    const viewport = passageWrapperRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    );
    if (!viewport) return;
    const saved = savedScrollPositions.current.get(`${book}-${chapter}`) ?? 0;
    viewport.scrollTop = saved;
    setIsScrolled(saved > 0);
  }, [book, chapter]);

  useEffect(() => {
    const viewport = passageWrapperRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    );
    if (!viewport) return;
    const onScroll = () => setIsScrolled(viewport.scrollTop > 0);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const passageKey = `${book}-${chapter}`;

  const headerInnerClass = isReadMode
    ? "max-w-[1400px] mx-auto px-6"
    : "max-w-[1320px] mx-auto px-5";

  return (
    <div ref={passageWrapperRef} className="h-full flex flex-col overflow-hidden">
      <div
        className={cn(
          "shrink-0 bg-background transition-shadow duration-200",
          isScrolled && "shadow-sm"
        )}
      >
        <div className={cn("grid", passageGridClass, headerInnerClass)}>
          <div className="flex items-center">
            <ChapterHeader book={book} chapter={chapter} />
          </div>
          <div className="flex items-end justify-between gap-2 pb-4">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {isReadMode ? "Reading Notes" : "Notes"}
            </span>
            <div className="inline-flex items-center rounded-md border bg-background p-0.5">
              <Button
                size="xs"
                variant={effectiveViewMode === "compose" ? "secondary" : "ghost"}
                onClick={() => setViewMode("compose")}
              >
                <Pencil className="h-3 w-3" />
                Compose
              </Button>
              <Button
                size="xs"
                variant={effectiveViewMode === "read" ? "secondary" : "ghost"}
                onClick={() => setViewMode("read")}
              >
                <BookOpen className="h-3 w-3" />
                Read
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
      <motion.div
        key={passageKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        ref={containerRef}
        className={containerClass}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className={topGridClass}>
          <div>
            <GospelParallelBanner book={book} chapter={chapter} />
          </div>
          <div className="flex items-start justify-end">
            {isReadMode && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="xs"
                  variant={showOnlyWithNotes ? "secondary" : "outline"}
                  onClick={() => setShowOnlyWithNotes((prev) => !prev)}
                >
                  {showOnlyWithNotes
                    ? "Showing noted verses"
                    : "Only verses with notes"}
                </Button>
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  Tag
                  <select
                    value={activeTag}
                    onChange={(e) => setActiveTag(e.target.value)}
                    className="h-7 rounded-md border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All tags</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        <div>
          {filteredVerses.map((verse) => (
            <VerseRowWithNotes
              key={verse.verseNumber}
              verseNumber={verse.verseNumber}
              text={verse.text}
              viewMode={effectiveViewMode}
              editorMode={editorMode}
              selectedVerses={selectedVerses}
              isInSelectionRange={isInSelection(verse.verseNumber)}
              isPassageSelection={isPassageSelection}
              singleNotes={verse.singleNotes}
              passageNotes={verse.passageNotes}
              passageAnchor={verseToPassageAnchor.get(verse.verseNumber)}
              hoveredVerse={hoveredVerse}
              hoveredPassageBubble={hoveredPassageBubble}
              hoveredSingleBubble={hoveredSingleBubble}
              openVerseKey={openVerseKey}
              openPassageKey={openPassageKey}
              creatingFor={creatingFor}
              editingNoteId={editingNoteId}
              isFocusTarget={
                focusSource === "search" && focusRange
                  ? verse.verseNumber >= focusRange.startVerse &&
                    verse.verseNumber <= focusRange.endVerse
                  : false
              }
              onAddNote={handleAddNote}
              onMouseDown={handleVerseMouseDown}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onSingleBubbleMouseEnter={handleSingleBubbleMouseEnter}
              onSingleBubbleMouseLeave={handleSingleBubbleMouseLeave}
              onPassageBubbleMouseEnter={handlePassageBubbleMouseEnter}
              onPassageBubbleMouseLeave={handlePassageBubbleMouseLeave}
              onOpenVerseNotes={openVerseNotes}
              onOpenPassageNotes={openPassageNotes}
              onEditNote={startEditingNote}
              onCancelEditing={cancelEditing}
              onDelete={handleDelete}
              onSaveEdit={handleSaveEdit}
              onSaveNew={handleSaveNew}
              onClickAway={handleClickAway}
              onStartCreatingPassageNote={startCreatingPassageNote}
            />
          ))}

          <div className={topGridClass}>
            <div>
              <ChapterPager book={book} chapter={chapter} />
              <CopyrightNotice text={data.copyright} />
            </div>
            <div />
          </div>
        </div>

        <Dialog
          open={shouldShowQuickCaptureDialog}
          onOpenChange={(open) => !open && handleClickAway()}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingNote ? "Edit note" : "Add note"}
              </DialogTitle>
            </DialogHeader>
            {editingNote ? (
              <NoteEditor
                verseRef={editingNote.verseRef}
                initialContent={editingNote.content}
                initialTags={editingNote.tags}
                presentation="dialog"
                variant={
                  editingNote.verseRef.startVerse ===
                  editingNote.verseRef.endVerse
                    ? "default"
                    : "passage"
                }
                onSave={handleSaveEdit}
                onCancel={handleClickAway}
              />
            ) : creatingFor ? (
              <NoteEditor
                verseRef={creatingFor}
                presentation="dialog"
                variant={
                  creatingFor.startVerse === creatingFor.endVerse
                    ? "default"
                    : "passage"
                }
                onSave={handleSaveNew}
                onCancel={handleClickAway}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </motion.div>
      </ScrollArea>
    </div>
  );
}
