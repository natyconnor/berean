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
  editorMode: "dialog" | "inline";
  isFocusMode: boolean;
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
  editorMode,
  isFocusMode,
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
    handleSaveEdit,
    handleSaveNew,
    cancelEditor,
    notifyEditorDirty,
    startCreatingPassageNote,
  } = passageNotesInteraction;

  const focusDistanceByKey = useMemo(() => {
    if (!isFocusMode) return EMPTY_FOCUS_MAP;

    const hasAnythingOpen =
      openVerseKeys.size > 0 ||
      openPassageKeys.size > 0 ||
      newDraftsByAnchor.size > 0;
    if (!hasAnythingOpen) return EMPTY_FOCUS_MAP;

    let focusedIndex = -1;
    for (let i = 0; i < filteredVerses.length; i++) {
      const item = filteredVerses[i];
      if (item.kind === "passageGroup") {
        if (openPassageKeys.has(item.anchorVerse)) {
          focusedIndex = i;
          break;
        }
      } else {
        if (
          openVerseKeys.has(item.verseNumber) ||
          openPassageKeys.has(item.verseNumber) ||
          newDraftsByAnchor.has(item.verseNumber)
        ) {
          focusedIndex = i;
          break;
        }
      }
    }

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
    newDraftsByAnchor,
    filteredVerses,
  ]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <ScrollArea
        className={cn("h-full min-h-0 overflow-hidden")}
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
                        onStartCreatingPassageNote={startCreatingPassageNote}
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
                      onStartCreatingPassageNote={startCreatingPassageNote}
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
