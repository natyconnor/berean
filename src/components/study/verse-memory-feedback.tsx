import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, PartyPopper, Sparkles, ThumbsUp } from "lucide-react";
import type { JSX } from "react";

import { formatMemoryDueLabel } from "@/lib/memory-due-label";
import { isLearningPhase, type MemorySchedule } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

import type { VerseAttemptQuality } from "./study-attempt-quality";

interface VerseMemoryFeedbackProps {
  quality: VerseAttemptQuality;
  /**
   * Stable id that changes when the user submits a new attempt. Used as the
   * motion key so the entrance animation replays on re-reveal, not on every
   * keystroke.
   */
  attemptKey: string;
  /**
   * When true (Memory Review), show schedule-consequence copy instead of the
   * celebration-only banners used on the deck/practice faces.
   */
  showScheduleOutcome?: boolean;
  /** Next schedule from `recordAttempt` (or a local optimistic fallback). */
  nextSchedule?: MemorySchedule | null;
  /** Clock used for due labels. Defaults to `Date.now()`. */
  now?: number;
}

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

function nextReviewPhrase(
  schedule: MemorySchedule | null | undefined,
  now: number,
): string {
  if (!schedule || isLearningPhase(schedule.status)) {
    return "soon";
  }
  return (
    formatMemoryDueLabel(schedule.status, schedule.dueAt, now)?.toLowerCase() ??
    "soon"
  );
}

export function VerseMemoryFeedback({
  quality,
  attemptKey,
  showScheduleOutcome = false,
  nextSchedule = null,
  now,
}: VerseMemoryFeedbackProps): JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const dueClock = now ?? 0;

  if (showScheduleOutcome) {
    if (
      quality === "off" ||
      (nextSchedule && isLearningPhase(nextSchedule.status))
    ) {
      return (
        <ScheduleBanner
          attemptKey={`lapse-${attemptKey}`}
          reduceMotion={!!reduceMotion}
          tone="lapse"
          icon={<BookOpen className="h-4 w-4 shrink-0" aria-hidden />}
          message="Needs practice — removing this verse from the review queue."
        />
      );
    }

    if (quality === "exact") {
      return (
        <ScheduleBanner
          attemptKey={`exact-${attemptKey}`}
          reduceMotion={!!reduceMotion}
          tone="exact"
          icon={<PartyPopper className="h-4 w-4 shrink-0" aria-hidden />}
          message={`Nailed it — next review ${nextReviewPhrase(nextSchedule, dueClock)}`}
          sparkle
        />
      );
    }

    return (
      <ScheduleBanner
        attemptKey={`close-${attemptKey}`}
        reduceMotion={!!reduceMotion}
        tone="close"
        icon={<ThumbsUp className="h-4 w-4 shrink-0" aria-hidden />}
        message={`Good recall — next review ${nextReviewPhrase(nextSchedule, dueClock)}`}
      />
    );
  }

  if (quality === "off") return null;

  if (quality === "exact") {
    return (
      <motion.div
        key={`exact-${attemptKey}`}
        role="status"
        aria-live="polite"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0.2, ease: "easeOut" }
            : { type: "spring", stiffness: 420, damping: 18 }
        }
        className={cn(
          "relative mx-auto flex w-fit max-w-full items-center gap-2",
          "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5",
          "text-sm font-semibold text-emerald-700 shadow-sm",
          "dark:text-emerald-300",
        )}
      >
        <PartyPopper className="h-4 w-4 shrink-0" aria-hidden />
        <span>Exactly right!</span>
        <Sparkles
          className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-300"
          aria-hidden
        />
        {!reduceMotion && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
              <ConfettiDot key={i} index={i} />
            ))}
          </span>
        )}
      </motion.div>
    );
  }

  // quality === "close"
  return (
    <motion.div
      key={`close-${attemptKey}`}
      role="status"
      aria-live="polite"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "mx-auto flex w-fit max-w-full items-center gap-2",
        "rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5",
        "text-sm font-medium text-amber-700 shadow-sm",
        "dark:text-amber-300",
      )}
    >
      <ThumbsUp className="h-4 w-4 shrink-0" aria-hidden />
      <span>Good job — really close!</span>
    </motion.div>
  );
}

function ScheduleBanner({
  attemptKey,
  reduceMotion,
  tone,
  icon,
  message,
  sparkle = false,
}: {
  attemptKey: string;
  reduceMotion: boolean;
  tone: "exact" | "close" | "lapse";
  icon: JSX.Element;
  message: string;
  sparkle?: boolean;
}): JSX.Element {
  return (
    <motion.div
      key={attemptKey}
      role="status"
      aria-live="polite"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "mx-auto flex w-full max-w-xl items-start gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm shadow-sm",
        tone === "exact" &&
          "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-800 dark:text-emerald-200",
        tone === "close" &&
          "border-amber-500/40 bg-amber-500/10 font-medium text-amber-800 dark:text-amber-200",
        tone === "lapse" &&
          "border-rose-500/35 bg-rose-500/10 font-medium text-rose-800 dark:text-rose-200",
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1 leading-snug">{message}</span>
      {sparkle && (
        <Sparkles
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-300"
          aria-hidden
        />
      )}
    </motion.div>
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
