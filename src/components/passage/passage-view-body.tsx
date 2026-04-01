import { useMemo, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { HighlightRange } from "@/lib/highlight-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChapterPager } from "@/components/bible/chapter-pager";
import { CopyrightNotice } from "@/components/bible/copyright-notice";
import { VerseRowWithNotes } from "./view/verse-row-with-notes";
import { PassageGroupWithNotes } from "./view/passage-group-with-notes";
import {
  NOTE_ENTER_TRANSITION,
  CROSSFADE_TRANSITION,
} from "./note-animation-config";
import type { PassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import {
  FOCUS_MODE_SPOTLIGHT_VERSE_END,
  FOCUS_MODE_SPOTLIGHT_VERSE_START,
} from "@/components/tutorial/focus-mode-tour";
import { cn } from "@/lib/utils";

const EMPTY_FOCUS_MAP = new Map<string, number | null>();

type PassageViewMode = "compose" | "read";

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

interface PassageViewBodyProps {
  book: string;
  chapter: number;
  dataCopyright: string;
  passageKey: string;
  containerClass: string;
  topGridClass: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  filteredVerses: VerseItem[];
  passageNotesInteraction: PassageNotesInteraction;
  effectiveViewMode: PassageViewMode;
  isFocusMode: boolean;
  focusGlowAmount: number;
  hasFocusRange: boolean;
  focusRange: { startVerse: number; endVerse: number } | null;
  reenteringFromGroup: Set<number>;
  highlightsByVerse: Map<number, HighlightRange[]>;
  forceAddButtonVisible: boolean;
  onCreateHighlight: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onRecolorHighlight: (highlightId: string, color: string) => void;
}

export function PassageViewBody({
  book,
  chapter,
  dataCopyright,
  passageKey,
  containerClass,
  topGridClass,
  viewportRef,
  filteredVerses,
  passageNotesInteraction,
  effectiveViewMode,
  isFocusMode,
  focusGlowAmount,
  hasFocusRange,
  focusRange,
  reenteringFromGroup,
  highlightsByVerse,
  forceAddButtonVisible,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
}: PassageViewBodyProps) {
  const {
    containerRef,
    selectedVerses,
    passageDraftVerses,
    isInSelection,
    isPassageSelection,
    verseToPassageAnchor,
    hoveredVerse,
    hoveredPassageBubble,
    hoveredSingleBubble,
    openVerseKeys,
    openPassageKeys,
    currentFocusTarget,
    newDraftsByAnchor,
    editingNoteIds,
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
    handleNoteDeleteCleanup,
    handleSaveEdit,
    handleSaveNew,
    cancelEditor,
    notifyEditorDirty,
    handleEditorFocus,
    startCreatingPassageNote,
  } = passageNotesInteraction;

  const focusDistanceByKey = useMemo(() => {
    if (!isFocusMode) return EMPTY_FOCUS_MAP;

    const hasAnythingOpen =
      openVerseKeys.size > 0 ||
      openPassageKeys.size > 0 ||
      newDraftsByAnchor.size > 0;
    if (!hasAnythingOpen) return EMPTY_FOCUS_MAP;
    if (!currentFocusTarget) return EMPTY_FOCUS_MAP;

    const focusedIndex = filteredVerses.findIndex((item) => {
      if (currentFocusTarget.kind === "passage") {
        return item.kind === "passageGroup"
          ? item.anchorVerse === currentFocusTarget.anchorVerse
          : item.verseNumber === currentFocusTarget.anchorVerse;
      }
      return (
        item.kind === "single" &&
        item.verseNumber === currentFocusTarget.verseNumber
      );
    });

    if (focusedIndex === -1) return EMPTY_FOCUS_MAP;

    const map = new Map<string, number | null>();
    for (let i = 0; i < filteredVerses.length; i++) {
      const item = filteredVerses[i];
      const key =
        item.kind === "passageGroup"
          ? `passage-group-${item.anchorVerse}`
          : String(item.verseNumber);
      map.set(key, Math.abs(i - focusedIndex));
    }

    return map;
  }, [
    isFocusMode,
    openVerseKeys,
    openPassageKeys,
    currentFocusTarget,
    newDraftsByAnchor,
    filteredVerses,
  ]);

  const focusGlowStyle = useMemo(() => {
    if (!isFocusMode || focusGlowAmount <= 0) return undefined;

    const innerPercent = Math.round(10 + focusGlowAmount * 0.18);
    const outerPercent = Math.round(5 + focusGlowAmount * 0.1);
    const innerBlur = Math.round(10 + focusGlowAmount * 0.12);
    const outerBlur = Math.round(20 + focusGlowAmount * 0.08);

    return {
      boxShadow: `inset 0 0 ${innerBlur}px color-mix(in oklab, var(--primary) ${innerPercent}%, transparent), inset 0 0 ${outerBlur}px color-mix(in oklab, var(--primary) ${outerPercent}%, transparent)`,
    };
  }, [focusGlowAmount, isFocusMode]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 transition-[box-shadow] duration-300"
        style={focusGlowStyle}
      />
      <ScrollArea
        className={cn("relative z-10 h-full min-h-0 overflow-hidden")}
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
                        currentChapter={{ book, chapter }}
                        highlightsByVerse={highlightsByVerse}
                        onCreateHighlight={onCreateHighlight}
                        onDeleteHighlight={onDeleteHighlight}
                        onRecolorHighlight={onRecolorHighlight}
                        isPassageOpen={openPassageKeys.has(item.anchorVerse)}
                        editingNoteIds={editingNoteIds}
                        draftsForAnchor={
                          newDraftsByAnchor.get(item.anchorVerse) ?? []
                        }
                        focusDistance={
                          focusDistanceByKey.get(
                            `passage-group-${item.anchorVerse}`,
                          ) ?? null
                        }
                        onOpenPassageNotes={openPassageNotes}
                        onClosePassageNotes={closePassageNotes}
                        onOpenVerseNotes={openVerseNotes}
                        onEditNote={startEditingNote}
                        onDelete={handleDelete}
                        onSaveEdit={handleSaveEdit}
                        onSaveNew={handleSaveNew}
                        onCancelEditor={cancelEditor}
                        onEditorDirtyChange={notifyEditorDirty}
                        onEditorFocus={handleEditorFocus}
                        onStartCreatingPassageNote={startCreatingPassageNote}
                        onNoteDeleteCleanup={handleNoteDeleteCleanup}
                        onPassageBubbleMouseEnter={
                          handlePassageBubbleMouseEnter
                        }
                        onPassageBubbleMouseLeave={
                          handlePassageBubbleMouseLeave
                        }
                        onCollapse={() => closePassageNotes(item.anchorVerse)}
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
                        : { height: 0, opacity: 0, overflow: "hidden" }
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
                  >
                    <VerseRowWithNotes
                      verseNumber={item.verseNumber}
                      text={item.text}
                      viewMode={effectiveViewMode}
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
                          ? item.verseNumber >= focusRange!.startVerse &&
                            item.verseNumber <= focusRange!.endVerse
                          : false
                      }
                      focusDistance={
                        focusDistanceByKey.get(String(item.verseNumber)) ?? null
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
                      onEditorFocus={handleEditorFocus}
                      onStartCreatingPassageNote={startCreatingPassageNote}
                      onNoteDeleteCleanup={handleNoteDeleteCleanup}
                      highlights={highlightsByVerse.get(item.verseNumber)}
                      onCreateHighlight={onCreateHighlight}
                      onDeleteHighlight={onDeleteHighlight}
                      onRecolorHighlight={onRecolorHighlight}
                      forceAddButtonVisible={
                        forceAddButtonVisible && item.verseNumber === 1
                      }
                      addNoteTourId={
                        item.verseNumber === 1 ? "passage-add-note" : undefined
                      }
                      rowTourId={
                        item.verseNumber >= FOCUS_MODE_SPOTLIGHT_VERSE_START &&
                        item.verseNumber <= FOCUS_MODE_SPOTLIGHT_VERSE_END
                          ? `passage-verse-${item.verseNumber}`
                          : undefined
                      }
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <div className={topGridClass}>
              <div>
                <ChapterPager book={book} chapter={chapter} />
                <CopyrightNotice text={dataCopyright} />
              </div>
              <div />
            </div>
          </div>
        </motion.div>
      </ScrollArea>
      <div className="cl-vignette" aria-hidden />
    </div>
  );
}
