import { useRef, useState } from "react";
import { Brain, Heart, X } from "lucide-react";

import { MEMORIZE_LABEL } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";

import { UnheartRangeDialog } from "./unheart-memorizing-dialog";

/** Phones and touch screens pin the bar to the shell's bottom edge. */
export const SELECTION_BAR_PINNED_QUERY =
  "(max-width: 639.98px), (pointer: coarse)";

export interface SelectionMemorizeBarProps {
  /** "Psalm 1:5–6". */
  reference: string;
  startVerse: number;
  endVerse: number;
  /** An exact heart exists for the selected range. */
  hearted: boolean;
  /** Unhearting the range would stop memorizing it. */
  stopsMemorizing: boolean;
  /** Hearts or (after its confirm) unhearts the range; `anchor` is the Heart button. */
  onToggleHeart: (anchor: HTMLElement) => void;
  onMemorize: (opener: HTMLElement) => void;
  onClear: () => void;
  /** Full width with 44px targets, for touch. */
  pinned?: boolean;
  className?: string;
}

/**
 * The quiet bar on a 2+ verse selection: range · Heart · Memorize · ×.
 * Unhearting from here asks the same confirm as the range's gutter pill.
 */
export function SelectionMemorizeBar({
  reference,
  startVerse,
  endVerse,
  hearted,
  stopsMemorizing,
  onToggleHeart,
  onMemorize,
  onClear,
  pinned = false,
  className,
}: SelectionMemorizeBarProps) {
  const heartRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const target = pinned ? "h-11 px-4 text-sm" : "h-[26px] px-2.5 text-xs";
  const focusRing =
    "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div
      role="toolbar"
      aria-label={`Selected verses, ${reference}`}
      className={cn(
        "flex items-center gap-1 border border-amber-400/35 bg-popover text-popover-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(50_35_15/0.1)] dark:border-[var(--cl-passage-line)]",
        pinned
          ? "w-full rounded-xl p-1"
          : "h-8 w-max max-w-full rounded-full py-[3px] pr-[3px] pl-2.5",
        className,
      )}
    >
      <span
        className={cn(
          "truncate font-medium text-muted-foreground tabular-nums",
          pinned ? "min-w-0 flex-1 px-2 text-sm" : "pr-1.5 text-xs",
        )}
      >
        {reference}
      </span>
      <button
        ref={heartRef}
        type="button"
        aria-pressed={hearted}
        onClick={(event) => {
          if (hearted) {
            setConfirmOpen(true);
            return;
          }
          onToggleHeart(event.currentTarget);
        }}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary font-medium text-secondary-foreground transition-colors hover:bg-secondary/80",
          target,
          focusRing,
        )}
      >
        <Heart
          aria-hidden
          className={cn(
            "size-3.5 text-red-500 dark:text-red-400",
            hearted && "fill-current",
          )}
        />
        {hearted ? "Hearted" : "Heart"}
      </button>
      <button
        type="button"
        onClick={(event) => onMemorize(event.currentTarget)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          target,
          focusRing,
        )}
      >
        <Brain aria-hidden className="size-3.5" />
        {MEMORIZE_LABEL}
      </button>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          pinned ? "size-11" : "size-[26px]",
          focusRing,
        )}
      >
        <X aria-hidden className="size-3.5" />
      </button>
      <UnheartRangeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          if (heartRef.current) onToggleHeart(heartRef.current);
        }}
        stopsMemorizing={stopsMemorizing}
        reference={reference}
        startVerse={startVerse}
        endVerse={endVerse}
      />
    </div>
  );
}
