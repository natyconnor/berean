import type { JSX } from "react";

import { memoryProgressFraction } from "@/lib/mastery-ring";
import { MAX_LEARN_STAGE, type MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";

interface LearningJourneyBarProps {
  /** Current learning band (0..3). */
  learnStage: number;
  /** Reps banked on the current band. Defaults to 0 when absent (e.g. legacy rows). */
  stageReps?: number;
  /**
   * Verse word count. When provided, Guided and Challenge required-rep counts
   * are length-adjusted so the bar matches the card and the server exactly.
   */
  wordCount?: number;
  /**
   * Lifecycle status. Learning fills its own bar to 100% learned. Reviewing
   * and mastered replace that with a separate mastery bar driven by
   * `intervalDays`.
   */
  status?: MemoryStatus;
  /**
   * Review interval in days. Ignored while learning. Once the verse has
   * graduated, this is how full the mastery bar is.
   */
  intervalDays?: number;
  className?: string;
}

/**
 * Compact progress bar for the phase the verse is in now.
 *
 * While learning, the track fills to 100% learned. After graduation it is
 * replaced by a new mastery track that starts empty and fills as the review
 * interval approaches mastered. Fill fraction is {@link memoryProgressFraction}.
 *
 * From Memory stays the learning (amber) color. Reviewing is sky and mastered
 * is emerald.
 */
export function LearningJourneyBar({
  learnStage,
  stageReps,
  wordCount,
  status,
  intervalDays,
  className,
}: LearningJourneyBarProps): JSX.Element {
  const graduated = status === "reviewing" || status === "mastered";
  const phase = graduated ? "mastery" : "learning";
  const clampedStage = Math.max(0, Math.min(MAX_LEARN_STAGE, learnStage));
  const stage = PRACTICE_STAGES[clampedStage] ?? PRACTICE_STAGES[0];
  const chrome = practiceChromeFor(clampedStage, status);
  const label = graduated
    ? status === "mastered"
      ? "Mastered"
      : "Reviewing"
    : stage.label;
  const fraction = memoryProgressFraction(
    status,
    learnStage,
    stageReps ?? 0,
    intervalDays ?? 0,
    wordCount,
  );
  const pct = Math.round(fraction * 100);
  const ariaKind = graduated ? "Progress to mastered" : "Learning journey";

  return (
    <div
      className={cn("space-y-1", className)}
      aria-label={`${ariaKind}: ${label} · ${pct}%`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            chrome.text,
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", chrome.dot)}
            aria-hidden
          />
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
      <div
        key={phase}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            chrome.dot,
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
