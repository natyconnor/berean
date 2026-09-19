import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { cn } from "@/lib/utils";
import { displayBookName } from "@/lib/bible-books";
import {
  chapterVerseMax,
  nudgeVerseRange,
  verseRangeBounds,
  type VerseRangeEnd,
  type VerseRangeNudge,
} from "@/lib/verse-range-nudge";
import type { VerseRef } from "@/lib/verse-ref-utils";

interface VerseRangeSpinnerChipProps {
  verseRef: VerseRef;
  isPassage?: boolean;
  disabled?: boolean;
  onNudge: (nextRef: VerseRef) => void;
}

function hasFinePointer(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function VerseRangeSpinnerChip({
  verseRef,
  isPassage = false,
  disabled = false,
  onNudge,
}: VerseRangeSpinnerChipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const revealed = hovered || pinned;
  const isRange = verseRef.startVerse !== verseRef.endVerse;
  const maxVerse = chapterVerseMax(verseRef.book, verseRef.chapter);
  const bounds = verseRangeBounds(verseRef, maxVerse);
  const bookChapter = `${displayBookName(verseRef.book)} ${verseRef.chapter}:`;

  useEffect(() => {
    if (!pinned) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinned(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  const handleNudge = (end: VerseRangeEnd, nudge: VerseRangeNudge) => {
    if (disabled) return;
    const next = nudgeVerseRange(verseRef, end, nudge, maxVerse);
    if (!next) return;
    onNudge(next);
  };

  return (
    <Badge
      variant="secondary"
      className="overflow-visible px-2 py-0.5 text-xs leading-none"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        ref={rootRef}
        className="inline-flex items-center gap-0 whitespace-nowrap touch-manipulation"
        data-testid="verse-range-spinner-chip"
        data-revealed={revealed ? "true" : "false"}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          if (hasFinePointer()) return;
          setPinned((current) => !current);
        }}
      >
        {isPassage ? <BookOpen className="mr-1 h-3 w-3 shrink-0" /> : null}
        <span className="leading-none">{bookChapter}</span>
        {isRange ? (
          <>
            <VerseNumberSpinner
              verse={verseRef.startVerse}
              revealed={revealed}
              disabled={disabled}
              upEnabled={bounds.canGrowStart}
              downEnabled={bounds.canShrinkStart}
              upLabel="Add previous verse"
              downLabel="Remove first verse"
              onUp={() => handleNudge("start", "grow")}
              onDown={() => handleNudge("start", "shrink")}
            />
            <span className="leading-none">-</span>
            <VerseNumberSpinner
              verse={verseRef.endVerse}
              revealed={revealed}
              disabled={disabled}
              upEnabled={bounds.canShrinkEnd}
              downEnabled={bounds.canGrowEnd}
              upLabel="Remove last verse"
              downLabel="Add next verse"
              onUp={() => handleNudge("end", "shrink")}
              onDown={() => handleNudge("end", "grow")}
            />
          </>
        ) : (
          <VerseNumberSpinner
            verse={verseRef.startVerse}
            revealed={revealed}
            disabled={disabled}
            upEnabled={bounds.canGrowStart}
            downEnabled={bounds.canGrowEnd}
            upLabel="Add previous verse"
            downLabel="Add next verse"
            onUp={() => handleNudge("start", "grow")}
            onDown={() => handleNudge("end", "grow")}
          />
        )}
      </span>
    </Badge>
  );
}

function VerseNumberSpinner({
  verse,
  revealed,
  disabled,
  upEnabled,
  downEnabled,
  upLabel,
  downLabel,
  onUp,
  onDown,
}: {
  verse: number;
  revealed: boolean;
  disabled: boolean;
  upEnabled: boolean;
  downEnabled: boolean;
  upLabel: string;
  downLabel: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span
      className="relative inline-flex items-center justify-center px-px"
      data-testid="verse-number-spinner"
      role="group"
      aria-label={`Verse ${verse}`}
    >
      <SpinnerChevron
        direction="up"
        label={upLabel}
        revealed={revealed}
        enabled={upEnabled}
        disabled={disabled}
        onClick={onUp}
      />
      <span className="tabular-nums leading-none">{verse}</span>
      <SpinnerChevron
        direction="down"
        label={downLabel}
        revealed={revealed}
        enabled={downEnabled}
        disabled={disabled}
        onClick={onDown}
      />
    </span>
  );
}

function SpinnerChevron({
  direction,
  label,
  revealed,
  enabled,
  disabled,
  onClick,
}: {
  direction: "up" | "down";
  label: string;
  revealed: boolean;
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  const isDisabled = disabled || !enabled;

  const step = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!revealed || isDisabled) return;
    onClick();
  };

  return (
    <TooltipButton
      type="button"
      variant="ghost"
      size="icon"
      tooltip={label}
      aria-label={label}
      aria-hidden={!revealed}
      tabIndex={revealed ? 0 : -1}
      disabled={isDisabled}
      data-testid={`verse-spinner-${direction}`}
      className={cn(
        "absolute left-1/2 z-20 size-5 -translate-x-1/2 rounded-sm p-0",
        "bg-background/90 text-foreground shadow-sm transition-opacity duration-150",
        "hover:bg-accent hover:text-accent-foreground",
        direction === "up" ? "bottom-full mb-px" : "top-full mt-px",
        revealed ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      onPointerDown={step}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
    </TooltipButton>
  );
}
