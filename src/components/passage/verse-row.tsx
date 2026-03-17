import { memo, useCallback, type RefObject } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  splitTextByHighlights,
  type HighlightRange,
} from "@/lib/highlight-utils";
import { getHighlightColor } from "@/lib/highlight-colors";
import { NOTE_LAYOUT_TRANSITION } from "./note-animation-config";

export interface VerseSelectionState {
  isSelected: boolean;
  isInSelectionRange: boolean;
  isPassageSelection: boolean;
}

export interface VerseNoteIndicatorState {
  hasOwnNote: boolean;
  isPassageAnchor: boolean;
  isInPassageRange: boolean;
}

export interface VerseHoverState {
  isPassageRangeActive: boolean;
  isNoteBubbleHovered: boolean;
}

export interface VerseFocusState {
  isTarget: boolean;
}

export interface VerseInteractionHandlers {
  onAddNote: (verseNumber: number) => void;
  onMouseDown: (verseNumber: number) => void;
  onMouseEnter: (verseNumber: number) => void;
  onMouseLeave: () => void;
}

interface VerseRowLeftProps {
  verseNumber: number;
  text: string;
  selection: VerseSelectionState;
  noteIndicator: VerseNoteIndicatorState;
  hover: VerseHoverState;
  focus?: VerseFocusState;
  isExpanded?: boolean;
  highlights?: HighlightRange[];
  verseTextRef?: RefObject<HTMLSpanElement | null>;
  onTextMouseUp?: () => void;
  forceAddButtonVisible?: boolean;
  addNoteTourId?: string;
  rowTourId?: string;
  handlers: VerseInteractionHandlers;
}

export const VerseRowLeft = memo(function VerseRowLeft({
  verseNumber,
  text,
  selection,
  noteIndicator,
  hover,
  focus,
  isExpanded = false,
  highlights,
  verseTextRef,
  onTextMouseUp,
  forceAddButtonVisible = false,
  addNoteTourId,
  rowTourId,
  handlers,
}: VerseRowLeftProps) {
  const { isSelected, isInSelectionRange, isPassageSelection } = selection;
  const { hasOwnNote, isPassageAnchor, isInPassageRange } = noteIndicator;
  const { isPassageRangeActive, isNoteBubbleHovered } = hover;
  const isFocusTarget = focus?.isTarget ?? false;
  const shouldFlipTooltipBelow = verseNumber <= 2;
  const { onAddNote, onMouseDown, onMouseEnter, onMouseLeave } = handlers;

  const segments =
    highlights && highlights.length > 0
      ? splitTextByHighlights(text, highlights)
      : null;

  const renderHighlightedText = useCallback(() => {
    if (!segments) return text;
    return segments.map((seg, i) => {
      if (!seg.color) {
        return <span key={i}>{seg.text}</span>;
      }
      const colorDef = getHighlightColor(seg.color);
      const bgClass = isExpanded
        ? colorDef?.bg
        : colorDef?.bgSubtle;
      return (
        <mark
          key={i}
          className={cn(
            "rounded-sm px-px",
            bgClass ?? "bg-yellow-200/70",
          )}
        >
          {seg.text}
        </mark>
      );
    });
  }, [segments, text, isExpanded]);

  return (
    <motion.div
      layout
      transition={{ layout: NOTE_LAYOUT_TRANSITION }}
      data-verse-number={verseNumber}
      {...(rowTourId ? { "data-tour-id": rowTourId } : {})}
      className={cn(
        "group relative h-full rounded-sm transition-[color,background-color,border-color,box-shadow] duration-200 ease-out",
        isExpanded
          ? "px-5 py-5 cursor-text"
          : "py-2 px-3 min-h-10 select-none cursor-pointer",
        isSelected &&
          isPassageSelection &&
          "bg-amber-100/80 dark:bg-amber-800/30 ring-1 ring-amber-400/40 dark:ring-amber-500/30",
        isSelected &&
          !isPassageSelection &&
          "bg-primary/10 ring-1 ring-primary/20",
        isInSelectionRange &&
          !isSelected &&
          isPassageSelection &&
          "bg-amber-50/60 dark:bg-amber-800/20",
        isInSelectionRange &&
          !isSelected &&
          !isPassageSelection &&
          "bg-primary/5",
        isFocusTarget &&
          "bg-sky-100/70 ring-1 ring-sky-400/40 dark:bg-sky-900/20 dark:ring-sky-500/40",
        isNoteBubbleHovered &&
          !isSelected &&
          !isInSelectionRange &&
          "bg-muted/70",
        isPassageRangeActive &&
          !isSelected &&
          !isInSelectionRange &&
          !isNoteBubbleHovered &&
          "bg-amber-50/60 dark:bg-amber-800/20",
        !isSelected && !isInSelectionRange && !isExpanded && "hover:bg-muted",
        isExpanded &&
          !isSelected &&
          !isInSelectionRange &&
          "bg-stone-50/80 dark:bg-stone-900/20",
      )}
      onMouseDown={
        isExpanded
          ? undefined
          : (e) => {
              e.preventDefault();
              onMouseDown(verseNumber);
            }
      }
      onMouseUp={isExpanded ? onTextMouseUp : undefined}
      onMouseEnter={() => onMouseEnter(verseNumber)}
      onMouseLeave={onMouseLeave}
    >
      <motion.div
        layout="position"
        transition={{ layout: NOTE_LAYOUT_TRANSITION }}
        className="flex h-full items-center"
      >
        <div className="flex w-full gap-2">
          <span
            className={cn(
              "flex items-start gap-1 shrink-0 select-none",
              isExpanded ? "pt-1.5" : "pt-0.5",
            )}
          >
            <span
              className={cn(
                "font-semibold text-muted-foreground tabular-nums min-w-6 text-right",
                isExpanded ? "text-base" : "text-xs",
              )}
            >
              {verseNumber}
            </span>
            <span className="mt-1 flex min-w-[6px] flex-col items-center gap-0.5">
              {hasOwnNote && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              )}
              {isPassageAnchor && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-amber-400/80 dark:bg-amber-400/50" />
              )}
              {isInPassageRange && !isPassageAnchor && (
                <span className="mt-0.5 h-0.5 w-2 shrink-0 rounded bg-amber-300/70 dark:bg-amber-500/40" />
              )}
            </span>
          </span>
          <span
            ref={verseTextRef}
            className={cn(
              "font-serif flex-1 min-w-0 whitespace-pre-wrap",
              isExpanded
                ? "text-2xl leading-relaxed"
                : "text-base leading-relaxed",
            )}
          >
            {renderHighlightedText()}
          </span>
          {!isExpanded && (
            <div
              className={cn(
                "group/addbtn relative ml-3 flex min-w-8 shrink-0 self-stretch items-center justify-center transition-opacity",
                forceAddButtonVisible
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              <button
                className="flex h-full w-full items-center justify-center rounded px-2 hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNote(verseNumber);
                }}
                {...(addNoteTourId ? { "data-tour-id": addNoteTourId } : {})}
              >
                <Plus className="h-4 w-4 text-primary" />
              </button>
              <span
                className={cn(
                  "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background opacity-0 transition-opacity group-hover/addbtn:opacity-100",
                  shouldFlipTooltipBelow ? "top-full mt-1.5" : "bottom-full mb-1.5",
                )}
              >
                Add note
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});
