import { type CSSProperties, type JSX, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { memoryProgressFraction } from "@/lib/mastery-ring";
import { statusLabel } from "@/lib/memory-copy";
import { MAX_LEARN_STAGE, type MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";

const BAR_FILL_MS = 500;
const BANNER_SETTLE_MS = 220;
const STAGE_FADE_MS = 150;
const DOT_PULSE_MS = 400;
const START_MARK = "0.375rem";

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
   * Verse word count. First letters and Fill in the blanks required-rep
   * counts are length-adjusted so the bar matches the card and the server
   * exactly. Required so no surface drops it and falls back to the
   * short-verse minima. `undefined` only where the length isn't known.
   */
  wordCount: number | undefined;
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
   * is in place. Used on a held miss and an after-miss refresher result.
   */
  from?: JourneyBarFill;
  className?: string;
}

type BarPhase = "mastery" | "learning";
type MotionKind = "none" | "slide" | "fade-down" | "fade-up";
type Beat = "idle" | "from" | "out" | "in" | "pulse" | "done";

function isGraduated(status?: MemoryStatus): boolean {
  return status === "reviewing" || status === "mastered";
}

function phaseOf(fill: JourneyBarFill): BarPhase {
  return isGraduated(fill.status) ? "mastery" : "learning";
}

/**
 * Compact progress bar for the phase the verse is in now.
 *
 * While learning, the track fills to 100% learned. After graduation it is
 * a mastery track that fills one equal share per exact on the path to
 * mastered. Fill fraction is {@link memoryProgressFraction}.
 *
 * From Memory stays the learning (amber) color. Reviewing is sky and mastered
 * is emerald. Mastered and Memorized share one track so a miss can recolor
 * without remounting. Memorized at 0% keeps a sky start mark.
 */
function fillPercent(
  fill: JourneyBarFill,
  wordCount: number | undefined,
): number {
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

function motionKind(
  from: JourneyBarFill | undefined,
  to: JourneyBarFill,
  wordCount: number | undefined,
  reduceMotion: boolean,
): MotionKind {
  if (!from || reduceMotion) return "none";
  const fromPhase = phaseOf(from);
  const toPhase = phaseOf(to);
  if (fromPhase !== toPhase) {
    return toPhase === "learning" ? "fade-down" : "fade-up";
  }
  if (
    fillPercent(from, wordCount) === fillPercent(to, wordCount) &&
    from.status === to.status
  ) {
    return "none";
  }
  return "slide";
}

function faceCopy(
  fill: JourneyBarFill,
  pct: number,
): { label: string; goal: string; ariaKind: string } {
  const graduated = isGraduated(fill.status);
  const clampedStage = Math.max(0, Math.min(MAX_LEARN_STAGE, fill.learnStage));
  const stage = PRACTICE_STAGES[clampedStage] ?? PRACTICE_STAGES[0];
  const label =
    fill.status === "reviewing" || fill.status === "mastered"
      ? statusLabel(fill.status)
      : stage.label;
  return {
    label,
    goal:
      fill.status === "mastered"
        ? `${pct}%`
        : graduated
          ? `${pct}% to mastered`
          : `${pct}% learned`,
    ariaKind: graduated ? "Progress to mastered" : "Learning journey",
  };
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
  const kind = motionKind(from, toFill, wordCount, reduceMotion);
  const animateKey = `${kind}:${fromPct}:${toPct}:${from?.status ?? ""}:${toFill.status ?? ""}`;
  const [beat, setBeat] = useState<Beat>("idle");
  const [playedKey, setPlayedKey] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "none") return;
    const timers: number[] = [];
    const at = (ms: number, next: Beat) => {
      timers.push(window.setTimeout(() => setBeat(next), ms));
    };
    if (kind === "slide") {
      at(BANNER_SETTLE_MS, "done");
    } else {
      at(BANNER_SETTLE_MS, "out");
      at(BANNER_SETTLE_MS + STAGE_FADE_MS, "in");
      if (kind === "fade-up") {
        at(BANNER_SETTLE_MS + STAGE_FADE_MS * 2, "pulse");
        at(BANNER_SETTLE_MS + STAGE_FADE_MS * 2 + DOT_PULSE_MS, "done");
      } else {
        at(BANNER_SETTLE_MS + STAGE_FADE_MS * 2, "done");
      }
    }
    timers.push(
      window.setTimeout(
        () => setPlayedKey(animateKey),
        kind === "slide"
          ? BANNER_SETTLE_MS
          : kind === "fade-up"
            ? BANNER_SETTLE_MS + STAGE_FADE_MS * 2 + DOT_PULSE_MS
            : BANNER_SETTLE_MS + STAGE_FADE_MS * 2,
      ),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [animateKey, kind]);

  const sliding = kind === "slide" && playedKey !== animateKey;
  const fading = kind === "fade-down" || kind === "fade-up";
  const fromOpacity = beat === "idle" || beat === "from" ? 1 : 0;
  const toOpacity =
    beat === "in" || beat === "pulse" || beat === "done" ? 1 : 0;
  const pulsing = kind === "fade-up" && beat === "pulse";
  const livePct = sliding ? fromPct : toPct;
  const copy = faceCopy(toFill, toPct);
  const motion =
    kind === "none" ? "none" : pulsing ? "pulse" : fading ? "fade" : "slide";

  return (
    <div
      className={cn("space-y-1", className)}
      aria-label={`${copy.ariaKind}: ${copy.label} · ${toPct}%`}
      data-journey-motion={motion}
    >
      {fading && from ? (
        <div className="relative">
          <JourneyFace
            fill={toFill}
            pct={toPct}
            pulseDot={pulsing}
            className="transition-opacity ease-out"
            style={{
              opacity: toOpacity,
              transitionDuration: `${STAGE_FADE_MS}ms`,
            }}
          />
          <div className="pointer-events-none absolute inset-0">
            <JourneyFace
              fill={from}
              pct={fromPct}
              className="transition-opacity ease-out"
              style={{
                opacity: fromOpacity,
                transitionDuration: `${STAGE_FADE_MS}ms`,
              }}
            />
          </div>
        </div>
      ) : (
        <JourneyFace
          fill={toFill}
          pct={toPct}
          barPct={livePct}
          slideColor={kind === "slide"}
          sliding={sliding}
        />
      )}
    </div>
  );
}

function JourneyFace({
  fill,
  pct,
  barPct = pct,
  pulseDot = false,
  slideColor = false,
  sliding = false,
  className,
  style,
}: {
  fill: JourneyBarFill;
  pct: number;
  barPct?: number;
  pulseDot?: boolean;
  slideColor?: boolean;
  sliding?: boolean;
  className?: string;
  style?: CSSProperties;
}): JSX.Element {
  const chrome = practiceChromeFor(
    Math.max(0, Math.min(MAX_LEARN_STAGE, fill.learnStage)),
    fill.status,
  );
  const copy = faceCopy(fill, pct);
  const graduated = isGraduated(fill.status);
  const startMark = graduated && barPct === 0;

  return (
    <div className={cn("space-y-1", className)} style={style}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            chrome.text,
            slideColor && "transition-colors duration-500 ease-out",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              chrome.dot,
              pulseDot && "animate-journey-dot-pulse",
            )}
            aria-hidden
          />
          {copy.label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {copy.goal}
        </span>
      </div>
      <div
        data-journey-track={phaseOf(fill)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
      >
        <div
          className={cn(
            "h-full rounded-full motion-reduce:transition-none",
            sliding || slideColor
              ? "transition-[width,background-color] duration-500 ease-out"
              : "transition-[width] duration-300",
            chrome.dot,
          )}
          style={{
            width: `${barPct}%`,
            minWidth: startMark ? START_MARK : undefined,
            transitionDuration:
              sliding || slideColor ? `${BAR_FILL_MS}ms` : undefined,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
