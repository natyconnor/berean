import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEsvPassage } from "@/hooks/use-esv-passage";
import { ChapterHeader } from "@/components/bible/chapter-header";
import { ChapterPager } from "@/components/bible/chapter-pager";
import { CopyrightNotice } from "@/components/bible/copyright-notice";
import { VerseRowWithNotes } from "./view/verse-row-with-notes";
import { PassageGroupWithNotes } from "./view/passage-group-with-notes";
import { usePassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import { NoteEditor } from "@/components/notes/note-editor";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { HighlightRange } from "@/lib/highlight-utils";
import { BookOpen, Loader2, Pencil } from "lucide-react";
import { useTabs } from "@/lib/use-tabs";
import { getAdjacentChapterDestinations } from "@/lib/chapter-navigation";
import { cn } from "@/lib/utils";
import { usePassageViewMode } from "./hooks/use-passage-view-mode";
import { usePassageKeyboardShortcuts } from "./hooks/use-passage-keyboard-shortcuts";
import { usePassageScrollRestoration } from "./hooks/use-passage-scroll-restoration";
import { usePassageViewTour } from "./hooks/use-passage-view-tour";
import { NOTE_ENTER_TRANSITION, CROSSFADE_TRANSITION } from "./note-animation-config";
import { api } from "../../../convex/_generated/api";

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
  const { data, loading, error } = useEsvPassage(book, chapter);
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>("all");
  const viewportRef = useRef<HTMLDivElement>(null);
  const { navigateActiveTab } = useTabs();
  const { previous, next } = getAdjacentChapterDestinations(book, chapter);
  const {
    containerRef,
    selectedVerses,
    passageDraftVerses,
    expandedPassageRanges,
    isInSelection,
    isPassageSelection,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    hoveredVerse,
    hoveredPassageBubble,
    hoveredSingleBubble,
    openVerseKeys,
    openPassageKeys,
    openEditors,
    editingNoteIds,
    newDraftsByAnchor,
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
    closeVerseNotes,
    openPassageNotes,
    closePassageNotes,
    startEditingNote,
    handleDelete,
    handleSaveEdit,
    handleSaveNew,
    handleClickAway,
    cancelEditor,
    notifyEditorDirty,
    hasDirtyEditors,
    startCreatingPassageNote,
    showDiscardConfirmation,
    confirmDiscard,
    cancelDiscard,
  } = usePassageNotesInteraction(book, chapter);

  const chapterHighlights = useQuery(api.highlights.getForChapter, {
    book,
    chapter,
  });
  const createHighlightMutation = useMutation(api.highlights.create);
  const removeHighlightMutation = useMutation(api.highlights.remove);
  const updateHighlightColorMutation = useMutation(api.highlights.updateColor);

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
      });
    },
    [book, chapter, createHighlightMutation],
  );

  const handleDeleteHighlight = useCallback(
    (highlightId: string) => {
      void removeHighlightMutation({ id: highlightId as Id<"highlights"> });
    },
    [removeHighlightMutation],
  );

  const handleRecolorHighlight = useCallback(
    (highlightId: string, color: string) => {
      void updateHighlightColorMutation({ id: highlightId as Id<"highlights">, color });
    },
    [updateHighlightColorMutation],
  );

  const { effectiveViewMode, isReadMode, editorMode, setViewMode } =
    usePassageViewMode({
      focusRange,
      forcedViewMode,
      focusSource,
    });

  const { forceAddButtonVisible, displaySingleVerseNotes } = usePassageViewTour(
    {
      book,
      chapter,
      effectiveViewMode,
      setViewMode,
      singleVerseNotes,
      openEditors,
      handleClickAway,
      handleAddNote,
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

  const dialogEditingNote = useMemo(() => {
    if (editingNoteIds.size === 0) return null;
    for (const id of editingNoteIds) {
      const note = noteById.get(id);
      if (note) return note;
    }
    return null;
  }, [editingNoteIds, noteById]);

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
      const hasVisibleNotes =
        singleNotes.length > 0 || passageNotes.length > 0;
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

  const prevGroupedVersesRef = useRef<Set<number>>(new Set());
  const reenteringFromGroup = useMemo(() => {
    const set = new Set<number>();
    for (const v of prevGroupedVersesRef.current) {
      if (!currentGroupedVerses.has(v)) {
        set.add(v);
      }
    }
    return set;
  }, [currentGroupedVerses]);

  useEffect(() => {
    prevGroupedVersesRef.current = currentGroupedVerses;
  }, [currentGroupedVerses]);

  const dialogDraft = useMemo(() => {
    for (const slot of openEditors.values()) {
      if (slot.kind === "new") return slot.verseRef;
    }
    return null;
  }, [openEditors]);
  const shouldShowQuickCaptureDialog =
    isReadMode && (!!dialogDraft || !!dialogEditingNote);
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
    setViewMode,
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
    <div className="h-full flex flex-col overflow-hidden">
      <div
        className={cn(
          "shrink-0 bg-background transition-shadow duration-200",
          isScrolled && "shadow-sm",
        )}
        data-passage-dismiss-exempt
      >
        <div className={cn("grid", passageGridClass, headerInnerClass)}>
          <div className="flex items-center">
            <ChapterHeader book={book} chapter={chapter} />
          </div>
          <div className="flex flex-col gap-2 pb-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </span>
              <div
                className="inline-flex items-center rounded-md border bg-background p-0.5"
                data-tour-id="passage-view-mode-toggle"
              >
                <Button
                  size="xs"
                  variant={
                    effectiveViewMode === "compose" ? "secondary" : "ghost"
                  }
                  onClick={() => setViewMode("compose")}
                  className="gap-1.5"
                >
                  <Pencil className="h-3 w-3" />
                  Compose
                  <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                    C
                  </kbd>
                </Button>
                <Button
                  size="xs"
                  variant={effectiveViewMode === "read" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("read")}
                  className="gap-1.5"
                >
                  <BookOpen className="h-3 w-3" />
                  Read
                  <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                    R
                  </kbd>
                </Button>
              </div>
            </div>

            {isReadMode &&
              (hasAnyNotes ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show</span>
                  <div className="inline-flex items-center rounded-md border bg-background p-0.5">
                    <Button
                      size="xs"
                      variant={noteVisibility === "all" ? "secondary" : "ghost"}
                      onClick={() => setNoteVisibility("all")}
                    >
                      All Notes
                    </Button>
                    <Button
                      size="xs"
                      variant={
                        noteVisibility === "noted" ? "secondary" : "ghost"
                      }
                      onClick={() => setNoteVisibility("noted")}
                    >
                      Only Noted
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No notes for this chapter
                </p>
              ))}
          </div>
        </div>
      </div>

      <ScrollArea
        className="flex-1 min-h-0 overflow-hidden"
        viewportRef={viewportRef}
      >
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
          <div>
            <AnimatePresence initial={false} mode="popLayout">
              {filteredVerses.map((item) => {
                if (item.kind === "passageGroup") {
                  return (
                    <motion.div
                      key={`passage-group-${item.anchorVerse}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={CROSSFADE_TRANSITION}
                    >
                      <PassageGroupWithNotes
                        verses={item.verses}
                        passageNotes={item.passageNotes}
                        singleNotesByVerse={item.singleNotesByVerse}
                        viewMode={effectiveViewMode}
                        editorMode={editorMode}
                        currentChapter={{ book, chapter }}
                        highlightsByVerse={highlightsByVerse}
                        onCreateHighlight={handleCreateHighlight}
                        onDeleteHighlight={handleDeleteHighlight}
                        onRecolorHighlight={handleRecolorHighlight}
                        isPassageOpen={openPassageKeys.has(item.anchorVerse)}
                        openVerseKeys={openVerseKeys}
                        editingNoteIds={editingNoteIds}
                        draftsForAnchor={
                          newDraftsByAnchor.get(item.anchorVerse) ?? []
                        }
                        onOpenPassageNotes={openPassageNotes}
                        onClosePassageNotes={closePassageNotes}
                        onOpenVerseNotes={openVerseNotes}
                        onCloseVerseNotes={closeVerseNotes}
                        onEditNote={startEditingNote}
                        onDelete={handleDelete}
                        onSaveEdit={handleSaveEdit}
                        onSaveNew={handleSaveNew}
                        onCancelEditor={cancelEditor}
                        onEditorDirtyChange={notifyEditorDirty}
                        onStartCreatingPassageNote={startCreatingPassageNote}
                        onPassageBubbleMouseEnter={handlePassageBubbleMouseEnter}
                        onPassageBubbleMouseLeave={handlePassageBubbleMouseLeave}
                        onCollapse={() =>
                          closePassageNotes(item.anchorVerse)
                        }
                      />
                    </motion.div>
                  );
                }

                const passageAnchor = verseToPassageAnchor.get(
                  item.verseNumber,
                );
                const isPassageRangeActive =
                  passageAnchor !== undefined &&
                  (hoveredVerse === passageAnchor ||
                    hoveredPassageBubble === passageAnchor);
                const isNoteBubbleHovered =
                  hoveredSingleBubble === item.verseNumber ||
                  hoveredPassageBubble === item.verseNumber;

                const isReentering = reenteringFromGroup.has(item.verseNumber);

                return (
                  <motion.div
                    key={item.verseNumber}
                    initial={
                      isReentering
                        ? { opacity: 0 }
                        : { height: 0, opacity: 0 }
                    }
                    animate={
                      isReentering
                        ? { opacity: 1 }
                        : {
                            height: "auto",
                            opacity: 1,
                            transitionEnd: { overflow: "visible" },
                          }
                    }
                    exit={{ opacity: 0 }}
                    transition={
                      isReentering
                        ? CROSSFADE_TRANSITION
                        : NOTE_ENTER_TRANSITION
                    }
                    style={isReentering ? undefined : { overflow: "hidden" }}
                  >
                    <VerseRowWithNotes
                      verseNumber={item.verseNumber}
                      text={item.text}
                      viewMode={effectiveViewMode}
                      editorMode={editorMode}
                      currentChapter={{ book, chapter }}
                      selectedVerses={selectedVerses}
                      isInSelectionRange={isInSelection(item.verseNumber)}
                      isPassageSelection={
                        passageDraftVerses.has(item.verseNumber) ||
                        isPassageSelection
                      }
                      singleNotes={item.singleNotes}
                      passageNotes={item.passageNotes}
                      passageAnchor={passageAnchor}
                      isPassageRangeActive={isPassageRangeActive}
                      isNoteBubbleHovered={isNoteBubbleHovered}
                      openVerseKeys={openVerseKeys}
                      openPassageKeys={openPassageKeys}
                      draftsForThisAnchor={
                        newDraftsByAnchor.get(item.verseNumber) ?? []
                      }
                      editingNoteIds={editingNoteIds}
                      isFocusTarget={
                        hasFocusRange
                          ? item.verseNumber >= focusRange.startVerse &&
                            item.verseNumber <= focusRange.endVerse
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
                      onCloseVerseNotes={closeVerseNotes}
                      onOpenPassageNotes={openPassageNotes}
                      onClosePassageNotes={closePassageNotes}
                      onEditNote={startEditingNote}
                      onDelete={handleDelete}
                      onSaveEdit={handleSaveEdit}
                      onSaveNew={handleSaveNew}
                      onCancelEditor={cancelEditor}
                      onEditorDirtyChange={notifyEditorDirty}
                      onStartCreatingPassageNote={startCreatingPassageNote}
                      highlights={highlightsByVerse.get(item.verseNumber)}
                      onCreateHighlight={handleCreateHighlight}
                      onDeleteHighlight={handleDeleteHighlight}
                      onRecolorHighlight={handleRecolorHighlight}
                      forceAddButtonVisible={
                        forceAddButtonVisible && item.verseNumber === 1
                      }
                      addNoteTourId={
                        item.verseNumber === 1 ? "passage-add-note" : undefined
                      }
                      rowTourId={
                        item.verseNumber === 1 ? "passage-verse-1" : undefined
                      }
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

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
            onOpenChange={(open) => !open && !hasDirtyEditors && handleClickAway()}
          >
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {dialogEditingNote ? "Edit note" : "Add note"}
                </DialogTitle>
              </DialogHeader>
              {dialogEditingNote ? (
                <NoteEditor
                  verseRef={dialogEditingNote.verseRef}
                  initialContent={dialogEditingNote.content}
                  initialBody={dialogEditingNote.body}
                  initialTags={dialogEditingNote.tags}
                  presentation="dialog"
                  variant={
                    dialogEditingNote.verseRef.startVerse ===
                    dialogEditingNote.verseRef.endVerse
                      ? "default"
                      : "passage"
                  }
                  onSave={(body, tags) =>
                    handleSaveEdit(dialogEditingNote.noteId, body, tags)
                  }
                  onCancel={handleClickAway}
                  onDirtyChange={(isDirty) =>
                    notifyEditorDirty(
                      `edit:${dialogEditingNote.noteId}`,
                      isDirty,
                    )
                  }
                />
              ) : dialogDraft ? (
                <NoteEditor
                  verseRef={dialogDraft}
                  presentation="dialog"
                  variant={
                    dialogDraft.startVerse === dialogDraft.endVerse
                      ? "default"
                      : "passage"
                  }
                  onSave={(body, tags) => handleSaveNew(dialogDraft, body, tags)}
                  onCancel={handleClickAway}
                  onDirtyChange={(isDirty) =>
                    notifyEditorDirty(
                      `new:${dialogDraft.startVerse}:${dialogDraft.endVerse}`,
                      isDirty,
                    )
                  }
                />
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            open={showDiscardConfirmation}
            onOpenChange={(open) => {
              if (!open) cancelDiscard();
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Discard unsaved notes?</DialogTitle>
                <DialogDescription>
                  You have unsaved content in one or more note editors. Are you
                  sure you want to discard your changes?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={cancelDiscard}>
                  Keep editing
                </Button>
                <Button variant="destructive" onClick={confirmDiscard}>
                  Discard
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </ScrollArea>
    </div>
  );
}
