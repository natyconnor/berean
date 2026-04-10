import { memo, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
  VerseRowLeft,
  type VerseSelectionState,
  type VerseNoteIndicatorState,
  type VerseHoverState,
  type VerseFocusState,
  type VerseInteractionHandlers,
  type PassageHeartControl,
} from "../verse-row";
import { HighlightToolbar } from "../highlight-toolbar";
import { HighlightMarkPopover } from "../highlight-mark-popover";
import { useHighlightPopover } from "../hooks/use-highlight-popover";
import type { HighlightRange } from "@/lib/highlight-utils";

export interface VerseTextPaneProps {
  verseNumber: number;
  text: string;
  selection: VerseSelectionState;
  noteIndicator: VerseNoteIndicatorState;
  hover: VerseHoverState;
  focus?: VerseFocusState;
  isExpanded: boolean;
  highlights?: HighlightRange[];
  onCreateHighlight?: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onRecolorHighlight?: (highlightId: string, color: string) => void;
  onCollapseVerse?: (verseNumber: number) => void;
  handlers: VerseInteractionHandlers;
  variant?: "default" | "groupedPassage";
  density?: "default" | "reading";
  showCollapseControl?: boolean;
  forceAddButtonVisible?: boolean;
  addNoteTourId?: string;
  rowTourId?: string;
  passageHeart?: PassageHeartControl | null;
}

export const VerseTextPane = memo(function VerseTextPane({
  verseNumber,
  text,
  selection,
  noteIndicator,
  hover,
  focus,
  isExpanded,
  highlights,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  onCollapseVerse,
  handlers,
  variant = "default",
  density = "default",
  showCollapseControl = true,
  forceAddButtonVisible = false,
  addNoteTourId,
  rowTourId,
  passageHeart = null,
}: VerseTextPaneProps) {
  const verseTextRef = useRef<HTMLSpanElement>(null);

  const {
    markPopover,
    activeHighlightId,
    handleMarkClick,
    handlePopoverClose,
    handlePopoverDelete,
    handlePopoverRecolor,
  } = useHighlightPopover({
    highlights,
    onDeleteHighlight,
    onRecolorHighlight,
  });

  const handleHighlight = useCallback(
    (startOffset: number, endOffset: number, color: string) => {
      onCreateHighlight?.(verseNumber, startOffset, endOffset, color);
    },
    [onCreateHighlight, verseNumber],
  );

  return (
    <>
      <VerseRowLeft
        verseNumber={verseNumber}
        text={text}
        selection={selection}
        noteIndicator={noteIndicator}
        hover={hover}
        focus={focus}
        isExpanded={isExpanded}
        onCollapseVerse={showCollapseControl ? onCollapseVerse : undefined}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        verseTextRef={verseTextRef}
        onMarkClick={handleMarkClick}
        forceAddButtonVisible={forceAddButtonVisible}
        addNoteTourId={addNoteTourId}
        rowTourId={rowTourId}
        passageHeart={passageHeart}
        handlers={handlers}
        variant={variant}
        density={density}
      />
      {isExpanded && onCreateHighlight && (
        <HighlightToolbar
          verseTextRef={verseTextRef}
          onHighlight={handleHighlight}
        />
      )}
      <AnimatePresence>
        {markPopover && (
          <HighlightMarkPopover
            key={markPopover.highlightId}
            anchorRect={markPopover.rect}
            highlightId={markPopover.highlightId}
            currentColor={markPopover.currentColor}
            onDelete={handlePopoverDelete}
            onRecolor={handlePopoverRecolor}
            onClose={handlePopoverClose}
          />
        )}
      </AnimatePresence>
    </>
  );
});
