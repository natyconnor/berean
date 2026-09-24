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
   * Lifecycle status. Learning fills the first half of the bar; reviewing
   * grows from there toward mastered using `intervalDays`.
   */
  status?: MemoryStatus;
  /**
   * Review interval in days. Ignored while learning; drives progress toward
   * mastered once the verse has graduated.
   */
  intervalDays?: number;
  className?: string;
}

/**
 * Compact progress bar: learning bands fill the first half, then reviewing
 * grows toward mastered. Fill fraction is {@link memoryProgressFraction},
 * keeping it in step with the mastery heart ring's two-phase mapping.
 *
 * Colors mirror the lifecycle palette: New → Learning → Reviewing → Mastered.
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
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
