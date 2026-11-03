import { type JSX, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { memoryProgressFraction } from "@/lib/mastery-ring";
import { statusLabel } from "@/lib/memory-copy";
import { MAX_LEARN_STAGE, type MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";

const BAR_FILL_MS = 500;
const BANNER_SETTLE_MS = 220;

export type JourneyBarFill = {
  learnStage: number;
  stageReps?: number;
  status?: MemoryStatus;
  intervalDays?: number;
  ease?: number;
};

interface LearningJourneyBarProps {
  /** Current learning band (0..3). */
  learnStage: number;
  /** Reps banked on the current band. Defaults to 0 when absent (e.g. legacy rows). */
  stageReps?: number;
  /**
   * Verse word count. When provided, First letters and Fill in the blanks
   * required-rep counts are length-adjusted so the bar matches the card and
   * the server exactly.
   */
  wordCount?: number;
  /**
   * Lifecycle status. Learning fills its own bar to 100% learned. Reviewing
   * and mastered replace that with a separate mastery bar.
   */
  status?: MemoryStatus;
  /**
   * Review interval in days. Ignored while learning. Together with `stageReps`
   * and `ease`, this estimates remaining exacts to mastered.
   */
  intervalDays?: number;
  /**
   * Current review ease. Used with `intervalDays` and `stageReps` to estimate
   * remaining exacts to mastered. Defaults to the scheduler start ease.
   */
  ease?: number;
  /**
   * Paint this fill first, then ease to the current value once the banner
   * is in place. Used for an after-miss refresher result.
   */
  from?: JourneyBarFill;
  className?: string;
}

/**
 * Compact progress bar for the phase the verse is in now.
 *
 * While learning, the track fills to 100% learned. After graduation it is
 * replaced by a new mastery track that starts empty and fills one equal share
 * per exact on the path to mastered. Fill fraction is
 * {@link memoryProgressFraction}.
 *
 * From Memory stays the learning (amber) color. Reviewing is sky and mastered
 * is emerald.
 */
function fillPercent(fill: JourneyBarFill, wordCount?: number): number {
  return Math.round(
    memoryProgressFraction(
      fill.status,
      fill.learnStage,
      fill.stageReps ?? 0,
      fill.intervalDays ?? 0,
      wordCount,
      fill.ease,
    ) * 100,
  );
}

export function LearningJourneyBar({
  learnStage,
  stageReps,
  wordCount,
  status,
  intervalDays,
  ease,
  from,
  className,
}: LearningJourneyBarProps): JSX.Element {
  const reduceMotion = useReducedMotion() ?? false;
  const toFill: JourneyBarFill = {
    learnStage,
    stageReps,
    status,
    intervalDays,
    ease,
  };
  const toPct = fillPercent(toFill, wordCount);
  const fromPct = from ? fillPercent(from, wordCount) : toPct;
  const shouldAnimate = Boolean(from) && !reduceMotion && fromPct !== toPct;
  const animateKey = shouldAnimate ? `${fromPct}-${toPct}` : "static";
  const [playedKey, setPlayedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldAnimate) return;
    const start = window.setTimeout(() => {
      setPlayedKey(animateKey);
    }, BANNER_SETTLE_MS);
    return () => window.clearTimeout(start);
  }, [animateKey, shouldAnimate]);

  const settled = !shouldAnimate || playedKey === animateKey;
  const pct = settled ? toPct : fromPct;
  const show = settled ? toFill : (from ?? toFill);
  const graduated = show.status === "reviewing" || show.status === "mastered";
  const phase = graduated ? "mastery" : "learning";
  const clampedStage = Math.max(0, Math.min(MAX_LEARN_STAGE, show.learnStage));
  const stage = PRACTICE_STAGES[clampedStage] ?? PRACTICE_STAGES[0];
  const chrome = practiceChromeFor(clampedStage, show.status);
  const label =
    show.status === "reviewing" || show.status === "mastered"
      ? statusLabel(show.status)
      : stage.label;
  const ariaKind = graduated ? "Progress to mastered" : "Learning journey";
  const goal =
    show.status === "mastered"
      ? `${toPct}%`
      : graduated
        ? `${toPct}% to mastered`
        : `${toPct}% learned`;

  return (
    <div
      className={cn("space-y-1", className)}
      aria-label={`${ariaKind}: ${label} · ${toPct}%`}
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
          {goal}
        </span>
      </div>
      <div
        key={shouldAnimate ? "journey-fill" : phase}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
      >
        <div
          className={cn(
            "h-full rounded-full motion-reduce:transition-none",
            shouldAnimate
              ? "transition-[width] duration-500 ease-out"
              : "transition-[width] duration-300",
            chrome.dot,
          )}
          style={{
            width: `${pct}%`,
            transitionDuration: shouldAnimate ? `${BAR_FILL_MS}ms` : undefined,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
