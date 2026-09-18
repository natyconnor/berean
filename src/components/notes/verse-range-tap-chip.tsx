import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

type ArmedEnd = VerseRangeEnd | null;

interface VerseRangeTapChipProps {
  verseRef: VerseRef;
  isPassage?: boolean;
  disabled?: boolean;
  onNudge: (nextRef: VerseRef) => void;
}

const CHIP_HEIGHT_CLASS = "h-5";

export function VerseRangeTapChip({
  verseRef,
  isPassage = false,
  disabled = false,
  onNudge,
}: VerseRangeTapChipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState<ArmedEnd>(null);
  const isRange = verseRef.startVerse !== verseRef.endVerse;
  const maxVerse = chapterVerseMax(verseRef.book, verseRef.chapter);
  const bounds = verseRangeBounds(verseRef, maxVerse);

  useEffect(() => {
    if (armed === null) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setArmed(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [armed]);

  const handleNudge = (end: VerseRangeEnd, nudge: VerseRangeNudge) => {
    if (disabled) return;
    const next = nudgeVerseRange(verseRef, end, nudge, maxVerse);
    if (!next) return;
    setArmed(end);
    onNudge(next);
  };

  const bookChapter = `${displayBookName(verseRef.book)} ${verseRef.chapter}:`;

  return (
    <Badge
      variant="secondary"
      className={cn(
        CHIP_HEIGHT_CLASS,
        "overflow-visible px-2 py-0 text-xs leading-none",
      )}
    >
      <span
        ref={rootRef}
        className={cn(
          "inline-flex items-center gap-0.5",
          CHIP_HEIGHT_CLASS,
          "whitespace-nowrap",
        )}
        data-verse-range-chip
      >
        {isPassage ? <BookOpen className="h-3 w-3 shrink-0" /> : null}
        <span className="leading-none">{bookChapter}</span>
        {isRange ? (
          <>
            <VerseNumberControl
              verse={verseRef.startVerse}
              end="start"
              armed={armed === "start"}
              disabled={disabled}
              growEnabled={bounds.canGrowStart}
              shrinkEnabled={bounds.canShrinkStart}
              growLabel="Add previous verse"
              shrinkLabel="Remove first verse"
              onToggleArm={() =>
                setArmed((current) => (current === "start" ? null : "start"))
              }
              onNudge={handleNudge}
            />
            <span className="leading-none text-muted-foreground">-</span>
            <VerseNumberControl
              verse={verseRef.endVerse}
              end="end"
              armed={armed === "end"}
              disabled={disabled}
              growEnabled={bounds.canGrowEnd}
              shrinkEnabled={bounds.canShrinkEnd}
              growLabel="Add next verse"
              shrinkLabel="Remove last verse"
              onToggleArm={() =>
                setArmed((current) => (current === "end" ? null : "end"))
              }
              onNudge={handleNudge}
            />
          </>
        ) : (
          <SingleVerseControl
            verse={verseRef.startVerse}
            armed={armed !== null}
            disabled={disabled}
            growStartEnabled={bounds.canGrowStart}
            growEndEnabled={bounds.canGrowEnd}
            onToggleArm={() =>
              setArmed((current) => (current === null ? "start" : null))
            }
            onNudge={handleNudge}
          />
        )}
      </span>
    </Badge>
  );
}

function SingleVerseControl({
  verse,
  armed,
  disabled,
  growStartEnabled,
  growEndEnabled,
  onToggleArm,
  onNudge,
}: {
  verse: number;
  armed: boolean;
  disabled: boolean;
  growStartEnabled: boolean;
  growEndEnabled: boolean;
  onToggleArm: () => void;
  onNudge: (end: VerseRangeEnd, nudge: VerseRangeNudge) => void;
}) {
  if (!armed) {
    return (
      <NumberButton
        verse={verse}
        label={`Verse ${verse}, tap to adjust`}
        disabled={disabled}
        onClick={onToggleArm}
      />
    );
  }

  return (
    <ArmedNumberBox>
      <StepperButton
        kind="plus"
        label="Add previous verse"
        enabled={growStartEnabled}
        disabled={disabled}
        onClick={() => onNudge("start", "grow")}
      />
      <NumberButton
        verse={verse}
        label={`Verse ${verse}, tap to close controls`}
        disabled={disabled}
        pressed
        onClick={onToggleArm}
      />
      <StepperButton
        kind="plus"
        label="Add next verse"
        enabled={growEndEnabled}
        disabled={disabled}
        onClick={() => onNudge("end", "grow")}
      />
    </ArmedNumberBox>
  );
}

function VerseNumberControl({
  verse,
  end,
  armed,
  disabled,
  growEnabled,
  shrinkEnabled,
  growLabel,
  shrinkLabel,
  onToggleArm,
  onNudge,
}: {
  verse: number;
  end: VerseRangeEnd;
  armed: boolean;
  disabled: boolean;
  growEnabled: boolean;
  shrinkEnabled: boolean;
  growLabel: string;
  shrinkLabel: string;
  onToggleArm: () => void;
  onNudge: (end: VerseRangeEnd, nudge: VerseRangeNudge) => void;
}) {
  if (!armed) {
    return (
      <NumberButton
        verse={verse}
        label={
          end === "start"
            ? `Starting verse ${verse}, tap to adjust`
            : `Ending verse ${verse}, tap to adjust`
        }
        disabled={disabled}
        onClick={onToggleArm}
      />
    );
  }

  return (
    <ArmedNumberBox>
      <StepperButton
        kind="plus"
        label={growLabel}
        enabled={growEnabled}
        disabled={disabled}
        onClick={() => onNudge(end, "grow")}
      />
      <NumberButton
        verse={verse}
        label={`Verse ${verse}, tap to close controls`}
        disabled={disabled}
        pressed
        onClick={onToggleArm}
      />
      <StepperButton
        kind="minus"
        label={shrinkLabel}
        enabled={shrinkEnabled}
        disabled={disabled}
        onClick={() => onNudge(end, "shrink")}
      />
    </ArmedNumberBox>
  );
}

function ArmedNumberBox({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-px rounded-sm bg-background/70 px-0.5 ring-1 ring-ring/70",
        CHIP_HEIGHT_CLASS,
      )}
      data-testid="armed-verse-number"
    >
      {children}
    </span>
  );
}

function NumberButton({
  verse,
  label,
  disabled,
  pressed = false,
  onClick,
}: {
  verse: number;
  label: string;
  disabled: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-sm px-0.5 tabular-nums leading-none",
        CHIP_HEIGHT_CLASS,
        "text-xs font-medium",
        !disabled && "cursor-pointer",
        !pressed && !disabled && "hover:bg-foreground/10",
        pressed && "bg-transparent",
      )}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {verse}
    </button>
  );
}

function StepperButton({
  kind,
  label,
  enabled,
  disabled,
  onClick,
}: {
  kind: "plus" | "minus";
  label: string;
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = kind === "plus" ? Plus : Minus;
  const isDisabled = disabled || !enabled;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-sm leading-none",
            isDisabled
              ? "cursor-not-allowed text-muted-foreground/40"
              : "cursor-pointer text-foreground hover:bg-foreground/10",
          )}
          aria-label={label}
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          <Icon className="size-2.5" strokeWidth={2.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
