import { motion, useReducedMotion } from "framer-motion";
import { PartyPopper, Sparkles, ThumbsUp } from "lucide-react";
import type { JSX } from "react";

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

export function VerseMemoryFeedback({
  quality,
  attemptKey,
}: VerseMemoryFeedbackProps): JSX.Element | null {
  const reduceMotion = useReducedMotion();
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
