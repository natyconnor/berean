import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronUp, Heart, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export interface PassageHeartControl {
  filled: boolean;
  onToggle: () => void;
}

interface VerseRowLeftProps {
  verseNumber: number;
  text: string;
  selection: VerseSelectionState;
  noteIndicator: VerseNoteIndicatorState;
  hover: VerseHoverState;
  focus?: VerseFocusState;
  isExpanded?: boolean;
  onCollapseVerse?: (verseNumber: number) => void;
  highlights?: HighlightRange[];
  activeHighlightId?: string | null;
  verseTextRef?: RefObject<HTMLSpanElement | null>;
  onTextMouseUp?: () => void;
  onMarkClick?: (highlightId: string, rect: DOMRect) => void;
  forceAddButtonVisible?: boolean;
  addNoteTourId?: string;
  rowTourId?: string;
  /** When set, shows a heart toggle (including when expanded, e.g. grouped passage). */
  passageHeart?: PassageHeartControl | null;
  handlers: VerseInteractionHandlers;
  variant?: "default" | "groupedPassage";
  density?: "default" | "reading";
}

// Explicit pixel values for each expand state. Editing these two objects is the
// single place to tune the verse growing animation — no class swaps involved.
const COLLAPSED = {
  paddingTop: "0.5rem", // py-2
  paddingBottom: "0.5rem",
  paddingLeft: "0.75rem", // px-3
  paddingRight: "0.75rem",
  verseNumberFontSize: "0.75rem", // text-xs
  textFontSize: "1rem", // text-base
  verseNumberPaddingTop: "0.125rem", // pt-0.5
} as const;

const COLLAPSED_READING = {
  paddingTop: "0.625rem",
  paddingBottom: "0.625rem",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  verseNumberFontSize: "0.8125rem", // ~13px, between text-xs and text-sm
  textFontSize: "1.1875rem", // ~19px, between text-lg and text-xl
  verseNumberPaddingTop: "0.1875rem",
} as const;

const EXPANDED = {
  paddingTop: "1.25rem", // py-5
  paddingBottom: "1.25rem",
  paddingLeft: "1.25rem", // px-5
  paddingRight: "1.25rem",
  verseNumberFontSize: "1rem", // text-base
  textFontSize: "1.5rem", // text-2xl
  verseNumberPaddingTop: "0.375rem", // pt-1.5
} as const;

const GROUPED_EXPANDED = {
  paddingTop: "0.625rem", // tighter vertical gap between grouped verses
  paddingBottom: "0.625rem",
  paddingLeft: "1.25rem",
  paddingRight: "1.25rem",
  verseNumberFontSize: "0.875rem", // text-sm
  textFontSize: "1.25rem", // text-xl — slightly smaller than solo expanded
  verseNumberPaddingTop: "0.25rem",
} as const;

const HEART_BURST_SPARK_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const HEART_BURST_SPARK_DISTANCE_PX = 22;

const PassageHeartAnimatedButton = memo(function PassageHeartAnimatedButton({
  passageHeart,
  shouldFlipTooltipBelow,
}: {
  passageHeart: PassageHeartControl;
  shouldFlipTooltipBelow: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [fxKey, setFxKey] = useState(0);
  const [playHeartAnim, setPlayHeartAnim] = useState(false);
  const [optimisticFilled, setOptimisticFilled] = useState(passageHeart.filled);
  // Track server value so we can reset optimistic state when it changes.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevServerFilled, setPrevServerFilled] = useState(passageHeart.filled);
  if (passageHeart.filled !== prevServerFilled) {
    setPrevServerFilled(passageHeart.filled);
    setOptimisticFilled(passageHeart.filled);
  }

  return (
    <div
      className={cn(
        "group/heart relative flex w-full min-h-8 items-center justify-center overflow-visible transition-opacity",
        optimisticFilled ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      {fxKey > 0 && !reduceMotion ? (
        <span
          key={fxKey}
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
        >
          <span
            className="absolute rounded-full bg-red-500/65 dark:bg-red-400/60"
            style={{
              width: 40,
              height: 40,
              top: "50%",
              left: "50%",
              marginLeft: -20,
              marginTop: -20,
              animation:
                "heart-burst-puff 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards",
            }}
          />
          {HEART_BURST_SPARK_DEGREES.map((deg, i) => {
            const r = (deg * Math.PI) / 180;
            const tx = Math.cos(r) * HEART_BURST_SPARK_DISTANCE_PX;
            const ty = Math.sin(r) * HEART_BURST_SPARK_DISTANCE_PX;
            return (
              <span
                key={deg}
                className="absolute rounded-full bg-red-500 dark:bg-red-400"
                style={
                  {
                    width: 6,
                    height: 6,
                    top: "50%",
                    left: "50%",
                    marginLeft: -3,
                    marginTop: -3,
                    "--spark-tx": `${tx}px`,
                    "--spark-ty": `${ty}px`,
                    animation: `heart-burst-spark 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.025}s forwards`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </span>
      ) : null}
      <motion.button
        type="button"
        aria-label={
          optimisticFilled ? "Remove from hearted verses" : "Heart this verse"
        }
        aria-pressed={optimisticFilled}
        className={cn(
          "relative z-10 flex h-full min-h-9 min-w-9 items-center justify-center rounded px-2 hover:bg-primary/10",
          optimisticFilled &&
            "text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300",
        )}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        disabled={playHeartAnim}
        aria-busy={playHeartAnim}
        onClick={(e) => {
          e.stopPropagation();
          const nextFilled = !optimisticFilled;
          setOptimisticFilled(nextFilled);
          if (nextFilled && !reduceMotion) {
            setFxKey((k) => k + 1);
            setPlayHeartAnim(true);
          }
          passageHeart.onToggle();
        }}
        whileTap={
          reduceMotion
            ? undefined
            : {
                scale: 0.92,
                transition: { duration: 0.08, ease: [0.22, 1, 0.36, 1] },
              }
        }
      >
        <motion.span
          className="inline-flex"
          initial={false}
          animate={
            playHeartAnim
              ? {
                  y: [0, -6, -1.5, 0],
                  scale: [1, 1.12, 1.04, 1],
                }
              : { y: 0, scale: 1 }
          }
          transition={
            playHeartAnim
              ? {
                  duration: 0.45,
                  times: [0, 0.32, 0.62, 1],
                  ease: [0.22, 1, 0.36, 1],
                }
              : { duration: 0.15 }
          }
          onAnimationComplete={() => {
            setPlayHeartAnim((p) => (p ? false : p));
          }}
        >
          <Heart
            className={cn(
              "h-[18px] w-[18px]",
              optimisticFilled ? "fill-current" : "text-primary",
            )}
          />
        </motion.span>
      </motion.button>
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background opacity-0 transition-opacity group-hover/heart:opacity-100",
          shouldFlipTooltipBelow ? "top-full mt-1.5" : "bottom-full mb-1.5",
        )}
      >
        {optimisticFilled ? "Unheart" : "Heart"}
      </span>
    </div>
  );
});

export const VerseRowLeft = memo(function VerseRowLeft({
  verseNumber,
  text,
  selection,
  noteIndicator,
  hover,
  focus,
  isExpanded = false,
  onCollapseVerse,
  highlights,
  activeHighlightId = null,
  verseTextRef,
  onTextMouseUp,
  onMarkClick,
  forceAddButtonVisible = false,
  addNoteTourId,
  rowTourId,
  passageHeart = null,
  handlers,
  variant = "default",
  density = "default",
}: VerseRowLeftProps) {
  const { isSelected, isInSelectionRange, isPassageSelection } = selection;
  const { hasOwnNote, isPassageAnchor, isInPassageRange } = noteIndicator;
  const { isPassageRangeActive, isNoteBubbleHovered } = hover;
  const isFocusTarget = focus?.isTarget ?? false;
  const shouldFlipTooltipBelow = verseNumber <= 2;
  const { onAddNote, onMouseDown, onMouseEnter, onMouseLeave } = handlers;

  const glintRef = useRef<{ x: number; y: number } | null>(null);
  const [glintPos, setGlintPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isWarmed, setIsWarmed] = useState(false);

  const showGlint =
    !isFocusTarget &&
    !isNoteBubbleHovered &&
    !isPassageRangeActive &&
    (isExpanded || (!isSelected && !isInSelectionRange));

  const handleGlintMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!showGlint) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glintRef.current = { x, y };
      setGlintPos({ x, y });
    },
    [showGlint],
  );

  const handleGlintLeave = useCallback(() => {
    glintRef.current = null;
    setGlintPos(null);
  }, []);

  useEffect(() => {
    return () => {
      if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
    };
  }, []);

  const sizes = isExpanded
    ? variant === "groupedPassage"
      ? GROUPED_EXPANDED
      : EXPANDED
    : density === "reading"
      ? COLLAPSED_READING
      : COLLAPSED;

  const segments =
    highlights && highlights.length > 0
      ? splitTextByHighlights(text, highlights)
      : null;

  const dragStateRef = useRef<{ startX: number; startY: number } | null>(null);

  const DRAG_THRESHOLD = 4;

  const renderHighlightedText = useCallback(
    (expanded: boolean) => {
      if (!segments) return text;
      return segments.map((seg, i) => {
        if (!seg.color) {
          return <span key={i}>{seg.text}</span>;
        }
        const colorDef = getHighlightColor(seg.color);
        const bgClass = expanded ? colorDef?.bg : colorDef?.bgSubtle;
        const isActiveHighlight =
          expanded &&
          seg.highlightId !== undefined &&
          seg.highlightId === activeHighlightId;
        return (
          <mark
            key={i}
            className={cn(
              "rounded-sm",
              bgClass ?? "bg-yellow-200/70",
              expanded && onMarkClick
                ? cn(
                    "cursor-pointer px-1 py-0.5 rounded transition-all duration-150 hover:brightness-[1.08] hover:saturate-[1.4] hover:shadow-sm",
                    isActiveHighlight &&
                      "brightness-[1.08] saturate-[1.4] shadow-sm",
                  )
                : "px-px",
            )}
            onPointerDown={
              expanded && onMarkClick
                ? (e) => {
                    dragStateRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                    };
                  }
                : undefined
            }
            onPointerUp={
              expanded && onMarkClick && seg.highlightId
                ? (e) => {
                    if (dragStateRef.current) {
                      const dx = e.clientX - dragStateRef.current.startX;
                      const dy = e.clientY - dragStateRef.current.startY;
                      if (Math.sqrt(dx * dx + dy * dy) <= DRAG_THRESHOLD) {
                        e.stopPropagation();
                        onMarkClick(
                          seg.highlightId!,
                          e.currentTarget.getBoundingClientRect(),
                        );
                      }
                      dragStateRef.current = null;
                    }
                  }
                : undefined
            }
          >
            {seg.text}
          </mark>
        );
      });
    },
    [activeHighlightId, segments, text, onMarkClick],
  );

  return (
    // No `layout` here — padding and font-size are driven by explicit `animate`
    // values so Framer Motion never needs to use scale-based projection to
    // correct this element's size, eliminating the "text zooms" artifact.
    <motion.div
      initial={
        variant === "groupedPassage"
          ? {
              paddingTop: COLLAPSED.paddingTop,
              paddingBottom: COLLAPSED.paddingBottom,
              paddingLeft: COLLAPSED.paddingLeft,
              paddingRight: COLLAPSED.paddingRight,
            }
          : undefined
      }
      animate={{
        paddingTop: sizes.paddingTop,
        paddingBottom: sizes.paddingBottom,
        paddingLeft: sizes.paddingLeft,
        paddingRight: sizes.paddingRight,
        y: isExpanded ? -3 : 0,
      }}
      transition={VERSE_EXPAND_TRANSITION}
      data-verse-number={verseNumber}
      {...(rowTourId ? { "data-tour-id": rowTourId } : {})}
      style={
        showGlint && glintPos
          ? ({ "--specular-x": `${glintPos.x}px` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "group relative h-full rounded-sm transition-[color,border-color,box-shadow] duration-200 ease-out",
        !isExpanded && "cl-verse-glint",
        isExpanded ? "cursor-text" : "min-h-10 select-none cursor-pointer",
        isSelected &&
          isPassageSelection &&
          !isExpanded &&
          "bg-amber-100/80 dark:bg-amber-800/30 ring-1 ring-amber-400/40 dark:ring-amber-500/30",
        isSelected &&
          !isPassageSelection &&
          !isExpanded &&
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
          variant !== "groupedPassage" &&
          "bg-primary/10 dark:bg-primary/15 rounded-lg cl-depth-2 cl-transition cl-flicker",
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
      onMouseMove={handleGlintMove}
      onMouseEnter={() => {
        onMouseEnter(verseNumber);
        if (showGlint) {
          warmTimerRef.current = setTimeout(() => setIsWarmed(true), 800);
        }
      }}
      onMouseLeave={() => {
        onMouseLeave();
        handleGlintLeave();
        if (warmTimerRef.current) {
          clearTimeout(warmTimerRef.current);
          warmTimerRef.current = null;
        }
        setIsWarmed(false);
      }}
    >
      {showGlint && (
        <>
          <div
            className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden"
            style={{
              backgroundImage: glintPos
                ? `radial-gradient(ellipse ${isExpanded ? "360px 240px" : "220px 140px"} at ${glintPos.x}px ${glintPos.y}px, var(--cl-glint), transparent 70%)`
                : undefined,
              opacity: glintPos ? 1 : 0,
              transition: glintPos
                ? "opacity 150ms ease-out"
                : "opacity 200ms ease-out",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden"
            style={{
              backgroundImage: glintPos
                ? `radial-gradient(ellipse ${isExpanded ? "500px 340px" : "320px 210px"} at ${glintPos.x}px ${glintPos.y}px, var(--cl-glint-warm), transparent 70%)`
                : undefined,
              opacity: isWarmed ? 1 : 0,
              transition: "opacity 2.5s ease-out",
            }}
          />
        </>
      )}
      {!isExpanded && (
        <div
          className="cl-verse-specular-strip rounded-[inherit]"
          aria-hidden
        />
      )}
      <div className="relative flex h-full items-center">
        <div className="flex w-full gap-2">
          <motion.span
            animate={{ paddingTop: sizes.verseNumberPaddingTop }}
            transition={VERSE_EXPAND_TRANSITION}
            className={cn(
              "flex flex-col items-start shrink-0 select-none overflow-visible",
              passageHeart && "w-9",
            )}
          >
            {isExpanded && onCollapseVerse ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="group/collapse flex items-start gap-1 shrink-0 select-none cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCollapseVerse(verseNumber);
                    }}
                  >
                    <span
                      style={{
                        fontSize: sizes.verseNumberFontSize,
                        transition:
                          "font-size 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                      className="font-semibold text-muted-foreground tabular-nums min-w-6 text-right"
                    >
                      {verseNumber}
                    </span>
                    <span className="mt-1 flex min-w-[6px] flex-col items-center gap-0.5">
                      <ChevronUp className="h-3 w-3 text-muted-foreground opacity-0 group-hover/collapse:opacity-100 transition-opacity" />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Collapse</TooltipContent>
              </Tooltip>
            ) : (
              <span className="flex items-start gap-1">
                <span
                  style={{
                    fontSize: sizes.verseNumberFontSize,
                    transition:
                      "font-size 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  className="font-semibold text-muted-foreground tabular-nums min-w-6 text-right"
                >
                  {verseNumber}
                </span>
                <span className="mt-1 flex min-w-[6px] flex-col items-center gap-0.5">
                  {hasOwnNote && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60 cl-ember-single" />
                  )}
                  {isPassageAnchor && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-amber-400/80 dark:bg-amber-400/50 cl-ember-passage" />
                  )}
                  {isInPassageRange && !isPassageAnchor && (
                    <span className="mt-0.5 h-0.5 w-2 shrink-0 rounded bg-amber-300/70 dark:bg-amber-500/40 cl-ember-range" />
                  )}
                </span>
              </span>
            )}
            {passageHeart && (
              <PassageHeartAnimatedButton
                passageHeart={passageHeart}
                shouldFlipTooltipBelow={shouldFlipTooltipBelow}
              />
            )}
          </motion.span>
          <div className="relative flex-1 min-w-0">
            {/* Collapsed copy — drives layout when not expanded */}
            <span
              aria-hidden={isExpanded}
              style={{
                fontSize: (density === "reading"
                  ? COLLAPSED_READING
                  : COLLAPSED
                ).textFontSize,
                opacity: isExpanded ? 0 : 1,
                pointerEvents: isExpanded ? "none" : undefined,
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
                fontSize: (variant === "groupedPassage"
                  ? GROUPED_EXPANDED
                  : EXPANDED
                ).textFontSize,
                opacity: isExpanded ? 1 : 0,
                pointerEvents: isExpanded ? undefined : "none",
                transition: "opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                ...(!isExpanded
                  ? { position: "absolute" as const, top: 0, left: 0, right: 0 }
                  : {}),
              }}
              className="font-serif w-full whitespace-pre-wrap leading-relaxed"
            >
              {renderHighlightedText(isExpanded)}
            </span>
          </div>
          {!isExpanded && (
            <div
              className={cn(
                "ml-3 flex min-w-8 shrink-0 self-stretch items-center justify-end transition-opacity",
                forceAddButtonVisible
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              <div className="group/addbtn relative flex h-full min-w-8 items-center justify-center">
                <button
                  type="button"
                  className="flex h-full min-h-9 w-full min-w-9 items-center justify-center rounded px-2 hover:bg-primary/10"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNote(verseNumber);
                  }}
                  {...(addNoteTourId ? { "data-tour-id": addNoteTourId } : {})}
                >
                  <Plus className="h-[18px] w-[18px] text-primary" />
                </button>
                <span
                  className={cn(
                    "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background opacity-0 transition-opacity group-hover/addbtn:opacity-100",
                    shouldFlipTooltipBelow
                      ? "top-full mt-1.5"
                      : "bottom-full mb-1.5",
                  )}
                >
                  Add note
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
