import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { badgeVariants } from "@/components/ui/badge-variants";
import { cn } from "@/lib/utils";
import {
  canNudgeVerseRange,
  type VerseRangeEnd,
  type VerseRangeNudge,
} from "@/lib/verse-range-nudge";
import { formatBookChapter, type VerseRef } from "@/lib/verse-ref-utils";

function nudgeLabel(end: VerseRangeEnd, nudge: VerseRangeNudge): string {
  if (end === "start" && nudge === "grow") return "Add previous verse";
  if (end === "start" && nudge === "shrink") return "Remove first verse";
  if (end === "end" && nudge === "shrink") return "Remove last verse";
  return "Add next verse";
}

interface VerseRangeOverlayChipProps {
  verseRef: VerseRef;
  disabled?: boolean;
  onNudge: (end: VerseRangeEnd, nudge: VerseRangeNudge) => void;
}

function prefersCoarsePointer(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function VerseRangeOverlayChip({
  verseRef,
  disabled = false,
  onNudge,
}: VerseRangeOverlayChipProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const isRange = verseRef.startVerse !== verseRef.endVerse;
  const overlayVisible = hovered || pinned || focusWithin;

  useEffect(() => {
    if (!pinned) return;
    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setPinned(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pinned]);

  return (
    <div
      ref={rootRef}
      role="group"
      tabIndex={0}
      data-verse-range-chip=""
      data-overlay-visible={overlayVisible ? "true" : "false"}
      aria-label={
        isRange
          ? `${formatBookChapter(verseRef.book, verseRef.chapter)}:${verseRef.startVerse}-${verseRef.endVerse}`
          : `${formatBookChapter(verseRef.book, verseRef.chapter)}:${verseRef.startVerse}`
      }
      className={cn(
        badgeVariants({ variant: "secondary" }),
        "relative overflow-visible text-xs outline-none",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setFocusWithin(false);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse" || prefersCoarsePointer()) {
          setPinned(true);
        }
      }}
    >
      {isRange ? <BookOpen className="h-3 w-3 shrink-0" /> : null}
      <span className="inline-flex items-center">
        {formatBookChapter(verseRef.book, verseRef.chapter)}:
        <NumberStepper
          verseNumber={verseRef.startVerse}
          top={{ end: "start", nudge: "grow" }}
          bottom={
            isRange
              ? { end: "start", nudge: "shrink" }
              : { end: "end", nudge: "grow" }
          }
          verseRef={verseRef}
          overlayVisible={overlayVisible}
          disabled={disabled}
          reduceMotion={reduceMotion === true}
          onNudge={onNudge}
        />
        {isRange ? (
          <>
            <span aria-hidden="true">-</span>
            <NumberStepper
              verseNumber={verseRef.endVerse}
              top={{ end: "end", nudge: "shrink" }}
              bottom={{ end: "end", nudge: "grow" }}
              verseRef={verseRef}
              overlayVisible={overlayVisible}
              disabled={disabled}
              reduceMotion={reduceMotion === true}
              onNudge={onNudge}
            />
          </>
        ) : null}
      </span>
    </div>
  );
}

function NumberStepper({
  verseNumber,
  top,
  bottom,
  verseRef,
  overlayVisible,
  disabled,
  reduceMotion,
  onNudge,
}: {
  verseNumber: number;
  top: { end: VerseRangeEnd; nudge: VerseRangeNudge };
  bottom: { end: VerseRangeEnd; nudge: VerseRangeNudge } | null;
  verseRef: VerseRef;
  overlayVisible: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  onNudge: (end: VerseRangeEnd, nudge: VerseRangeNudge) => void;
}) {
  return (
    <span className="relative inline-flex items-center tabular-nums">
      <NudgeButton
        action={top}
        side="top"
        verseRef={verseRef}
        overlayVisible={overlayVisible}
        disabled={disabled}
        reduceMotion={reduceMotion}
        onNudge={onNudge}
      />
      {verseNumber}
      {bottom ? (
        <NudgeButton
          action={bottom}
          side="bottom"
          verseRef={verseRef}
          overlayVisible={overlayVisible}
          disabled={disabled}
          reduceMotion={reduceMotion}
          onNudge={onNudge}
        />
      ) : null}
    </span>
  );
}

function NudgeButton({
  action,
  side,
  verseRef,
  overlayVisible,
  disabled,
  reduceMotion,
  onNudge,
}: {
  action: { end: VerseRangeEnd; nudge: VerseRangeNudge };
  side: "top" | "bottom";
  verseRef: VerseRef;
  overlayVisible: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  onNudge: (end: VerseRangeEnd, nudge: VerseRangeNudge) => void;
}) {
  const allowed = canNudgeVerseRange(verseRef, action.end, action.nudge);
  const revealed = overlayVisible && !disabled && allowed;
  const label = nudgeLabel(action.end, action.nudge);

  return (
    <TooltipButton
      type="button"
      variant="ghost"
      size="icon"
      data-verse-nudge={`${action.end}:${action.nudge}`}
      aria-label={label}
      tooltip={label}
      tabIndex={revealed ? 0 : -1}
      disabled={!revealed}
      aria-hidden={overlayVisible ? undefined : true}
      className={cn(
        "absolute left-1/2 z-20 size-4! h-4! w-4! -translate-x-1/2 p-0!",
        side === "top" ? "bottom-full" : "top-full",
        "transition-opacity duration-150 motion-reduce:transition-none",
        reduceMotion && "transition-none",
        overlayVisible
          ? "opacity-100"
          : "pointer-events-none opacity-0! disabled:opacity-0!",
      )}
      onClick={() => {
        if (!revealed) return;
        onNudge(action.end, action.nudge);
      }}
    >
      {side === "top" ? (
        <ChevronUp className="size-3" />
      ) : (
        <ChevronDown className="size-3" />
      )}
    </TooltipButton>
  );
}
