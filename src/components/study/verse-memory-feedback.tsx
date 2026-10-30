import { motion, useReducedMotion } from "framer-motion";
import type { JSX, ReactNode } from "react";

import { accuracyFeedback, type AccuracyBand } from "@/lib/accuracy-feedback";
import {
  isLearningPhase,
  reviewGradeOutcome,
  type MemorySchedule,
  type ReviewGradeOutcome,
} from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

import { FROM_MEMORY_CLOSE_MESSAGE } from "./from-memory-messages";
import type {
  AttemptErrorCounts,
  VerseAttemptQuality,
} from "./study-attempt-quality";
import {
  attemptPraiseLine,
  reviewOutcomeMessage,
} from "./verse-attempt-feedback";

interface VerseMemoryFeedbackProps {
  quality: VerseAttemptQuality;
  /**
   * Stable id that changes when the user submits a new attempt. Used as the
   * motion key so the entrance animation replays on re-reveal, not on every
   * keystroke.
   */
  attemptKey: string;
  /** When true (Memory Review), close with what the grade does to the schedule. */
  showScheduleOutcome?: boolean;
  /**
   * The graduating From Memory recall is the only learning step that requires
   * a perfect grade. When true, a close attempt explains that 100% is needed.
   */
  requireExactToAdvance?: boolean;
  /** Next schedule from `recordAttempt` (or a local optimistic fallback). */
  nextSchedule?: MemorySchedule | null;
  /** Clock used for due labels. Defaults to `Date.now()`. */
  now?: number;
  /** Percent recalled; required to band retry vs hold on Review. */
  accuracy?: number;
  /** Diff error tallies — unlocks one-word-off and typo-only copy. */
  errors?: AttemptErrorCounts;
  /** Trails the percentage, e.g. "Pass at 85%". */
  note?: string;
  /** Replaces the usual praise line when this result has its own next step. */
  praiseLine?: string;
  scheduleHeld?: boolean;
  /**
   * Quiet after-miss offer, rendered on the percentage row and kept outside
   * the status live region so it is not announced as part of the score.
   */
  refresherOffer?: ReactNode;
}

const BANNER_TONE: Record<AccuracyBand, string> = {
  exact: "border-emerald-500/40 bg-emerald-500/10",
  nearly: "border-emerald-500/30 bg-emerald-500/[0.06]",
  progress: "border-amber-500/40 bg-amber-500/10",
  again: "border-sky-500/30 bg-sky-500/10",
};

const LEAD_TONE: Record<AccuracyBand, string> = {
  exact: "text-emerald-700 dark:text-emerald-300",
  nearly: "text-emerald-700 dark:text-emerald-300",
  progress: "text-amber-700 dark:text-amber-300",
  again: "text-sky-800 dark:text-sky-200",
};

const CONFETTI_COUNT = 10;
const CONFETTI_RADIUS = 72;
// Tailwind palette roughly matching the app's chart tokens; we keep these
// as raw colors so confetti pops against both light and dark backgrounds.
const CONFETTI_COLORS = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ec4899",
  "#a855f7",
  "#ef4444",
] as const;

/**
 * "How you did" in one banner: an emoji, the honest headline, a specific
 * word of encouragement, the percentage, and (in Review) what happens next.
 * A word-for-word recall bursts confetti unless motion is reduced.
 */
export function VerseMemoryFeedback({
  quality,
  attemptKey,
  showScheduleOutcome = false,
  requireExactToAdvance = false,
  nextSchedule = null,
  now,
  accuracy,
  errors,
  note,
  praiseLine,
  refresherOffer,
  scheduleHeld = false,
}: VerseMemoryFeedbackProps): JSX.Element {
  const reduceMotion = useReducedMotion() ?? false;
  const scored =
    accuracy ?? (quality === "exact" ? 100 : quality === "close" ? 70 : 0);
  const outcome = reviewGradeOutcome(quality, scored);
  const feedback = accuracyFeedback(scored, {
    exact: quality === "exact",
    scheduleHeld,
  });
  const { band } = feedback;
  const celebrate = band === "exact";
  const praise =
    praiseLine ??
    (!showScheduleOutcome && requireExactToAdvance && quality === "close"
      ? FROM_MEMORY_CLOSE_MESSAGE
      : attemptPraiseLine({ accuracy: scored, outcome, errors }));
  const consequence =
    showScheduleOutcome && !scheduleHeld
      ? scheduleConsequence(outcome, nextSchedule, now ?? 0)
      : null;
  const scoreLine = `${scored}% recalled${note ? ` · ${note}` : ""}`;
  const statusCopy = [
    feedback.lead,
    feedback.rest,
    praise,
    scoreLine,
    consequence,
  ]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(" ");

  return (
    <motion.div
      key={`${band}-${attemptKey}`}
      role={refresherOffer ? undefined : "status"}
      aria-live={refresherOffer ? undefined : "polite"}
      data-tone={band}
      data-result-banner=""
      // A pop, not a fade: the result reads the moment it lands.
      initial={reduceMotion ? false : { y: -6, scale: celebrate ? 0.94 : 0.98 }}
      animate={{ y: 0, scale: 1 }}
      transition={
        celebrate
          ? { type: "spring", stiffness: 420, damping: 18 }
          : { duration: 0.22, ease: "easeOut" }
      }
      className={cn(
        "relative mx-auto flex w-full max-w-xl scroll-mt-2 flex-col items-center gap-1 overflow-visible rounded-2xl border px-4 py-4 text-center shadow-sm",
        BANNER_TONE[band],
      )}
    >
      {refresherOffer ? (
        <div role="status" aria-live="polite" className="sr-only">
          {statusCopy}
        </div>
      ) : null}
      <ResultEmoji
        emoji={feedback.emoji}
        celebrate={celebrate}
        reduceMotion={reduceMotion}
      />
      <p className="mt-1 text-lg leading-snug text-balance">
        <span className={cn("font-semibold", LEAD_TONE[band])}>
          {feedback.lead}
        </span>
        {feedback.rest ? (
          <span className="text-foreground/80"> {feedback.rest}</span>
        ) : null}
      </p>
      <p className="text-sm font-medium leading-snug text-balance text-foreground/90">
        {praise}
      </p>
      <div className="flex flex-wrap items-start justify-center gap-x-1.5 sm:items-center">
        <p className="text-xs tabular-nums text-muted-foreground">
          {scoreLine}
        </p>
        {refresherOffer}
      </div>
      {consequence ? (
        <p className="mt-1 text-sm leading-snug text-balance text-foreground/80">
          {consequence}
        </p>
      ) : null}
    </motion.div>
  );
}

/**
 * A lapse that drops the verse back into learning reads as a lapse even when
 * the raw grade was a hold or retry.
 */
function scheduleConsequence(
  outcome: ReviewGradeOutcome,
  nextSchedule: MemorySchedule | null,
  now: number,
): string | null {
  const lapsedToLearning =
    nextSchedule !== null && isLearningPhase(nextSchedule.status);
  return reviewOutcomeMessage({
    outcome: lapsedToLearning && outcome !== "lapse" ? "lapse" : outcome,
    nextSchedule,
    now,
    lapsedToLearning,
  });
}

function ResultEmoji({
  emoji,
  celebrate,
  reduceMotion,
}: {
  emoji: string;
  celebrate: boolean;
  reduceMotion: boolean;
}): JSX.Element {
  return (
    <span className="relative inline-flex h-10 w-10 items-center justify-center">
      <motion.span
        aria-hidden
        data-testid="result-emoji"
        className="text-3xl leading-none select-none"
        initial={
          reduceMotion
            ? false
            : celebrate
              ? { opacity: 0, scale: 0.3, rotate: -18 }
              : { opacity: 0, scale: 0.8 }
        }
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={
          celebrate
            ? { type: "spring", stiffness: 420, damping: 14 }
            : { duration: 0.25, ease: "easeOut" }
        }
      >
        {emoji}
      </motion.span>
      {celebrate && !reduceMotion ? <ConfettiBurst /> : null}
    </span>
  );
}

function ConfettiBurst(): JSX.Element {
  return (
    <span
      aria-hidden
      data-testid="confetti-burst"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiDot key={i} index={i} />
      ))}
    </span>
  );
}

function ConfettiDot({ index }: { index: number }): JSX.Element {
  const angle = (index / CONFETTI_COUNT) * Math.PI * 2;
  // Alternate radius so dots don't land in a perfect ring.
  const radius = CONFETTI_RADIUS * (index % 2 === 0 ? 1 : 0.7);
  const targetX = Math.cos(angle) * radius;
  const targetY = Math.sin(angle) * radius;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  return (
    <motion.span
      className="absolute h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: color }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={{
        x: targetX,
        y: targetY,
        opacity: [0, 1, 0],
        scale: [0.3, 1, 0.4],
      }}
      transition={{
        delay: 0.08 + index * 0.015,
        duration: 0.9,
        ease: "easeOut",
        times: [0, 0.3, 1],
      }}
    />
  );
}
