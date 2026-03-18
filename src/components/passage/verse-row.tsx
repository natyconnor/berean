import { memo, useCallback, type RefObject } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  splitTextByHighlights,
  type HighlightRange,
} from "@/lib/highlight-utils";
import { getHighlightColor } from "@/lib/highlight-colors";
import { VERSE_EXPAND_TRANSITION } from "./note-animation-config";

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

// Explicit pixel values for each expand state. Editing these two objects is the
// single place to tune the verse growing animation — no class swaps involved.
const COLLAPSED = {
  paddingTop: "0.5rem",    // py-2
  paddingBottom: "0.5rem",
  paddingLeft: "0.75rem",  // px-3
  paddingRight: "0.75rem",
  verseNumberFontSize: "0.75rem",  // text-xs
  textFontSize: "1rem",            // text-base
  verseNumberPaddingTop: "0.125rem", // pt-0.5
} as const;

const EXPANDED = {
  paddingTop: "1.25rem",   // py-5
  paddingBottom: "1.25rem",
  paddingLeft: "1.25rem",  // px-5
  paddingRight: "1.25rem",
  verseNumberFontSize: "1rem",     // text-base
  textFontSize: "1.5rem",          // text-2xl
  verseNumberPaddingTop: "0.375rem", // pt-1.5
} as const;

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

  const sizes = isExpanded ? EXPANDED : COLLAPSED;

  const segments =
    highlights && highlights.length > 0
      ? splitTextByHighlights(text, highlights)
      : null;

  const renderHighlightedText = useCallback((expanded: boolean) => {
    if (!segments) return text;
    return segments.map((seg, i) => {
      if (!seg.color) {
        return <span key={i}>{seg.text}</span>;
      }
      const colorDef = getHighlightColor(seg.color);
      const bgClass = expanded ? colorDef?.bg : colorDef?.bgSubtle;
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
  }, [segments, text]);

  return (
    // No `layout` here — padding and font-size are driven by explicit `animate`
    // values so Framer Motion never needs to use scale-based projection to
    // correct this element's size, eliminating the "text zooms" artifact.
    <motion.div
      animate={{
        paddingTop: sizes.paddingTop,
        paddingBottom: sizes.paddingBottom,
        paddingLeft: sizes.paddingLeft,
        paddingRight: sizes.paddingRight,
      }}
      transition={VERSE_EXPAND_TRANSITION}
      data-verse-number={verseNumber}
      {...(rowTourId ? { "data-tour-id": rowTourId } : {})}
      className={cn(
        "group relative h-full rounded-sm transition-[color,background-color,border-color,box-shadow] duration-200 ease-out",
        isExpanded ? "cursor-text" : "min-h-10 select-none cursor-pointer",
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
      {/* Plain div — no layout="position" needed since the parent no longer
          uses scale-based projection. */}
      <div className="flex h-full items-center">
        <div className="flex w-full gap-2">
          <motion.span
            animate={{ paddingTop: sizes.verseNumberPaddingTop }}
            transition={VERSE_EXPAND_TRANSITION}
            className="flex items-start gap-1 shrink-0 select-none"
          >
            <span
              style={{
                fontSize: sizes.verseNumberFontSize,
                transition: "font-size 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              className="font-semibold text-muted-foreground tabular-nums min-w-6 text-right"
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
          </motion.span>
          <div className="relative flex-1 min-w-0">
            {/* Collapsed copy — drives layout when not expanded */}
            <span
              aria-hidden={isExpanded}
              style={{
                fontSize: COLLAPSED.textFontSize,
                opacity: isExpanded ? 0 : 1,
                transition: "opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                ...(isExpanded
                  ? { position: "absolute" as const, top: 0, left: 0, right: 0 }
                  : {}),
              }}
              className="font-serif w-full whitespace-pre-wrap leading-relaxed"
            >
              {renderHighlightedText(false)}
            </span>

            {/* Expanded copy — drives layout when expanded; owns verseTextRef for HighlightToolbar */}
            <span
              ref={verseTextRef}
              aria-hidden={!isExpanded}
              style={{
                fontSize: EXPANDED.textFontSize,
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                ...(!isExpanded
                  ? { position: "absolute" as const, top: 0, left: 0, right: 0 }
                  : {}),
              }}
              className="font-serif w-full whitespace-pre-wrap leading-relaxed"
            >
              {renderHighlightedText(true)}
            </span>
          </div>
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
      </div>
    </motion.div>
  );
});
