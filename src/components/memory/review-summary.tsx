import type { JSX } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";

import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { Button } from "@/components/ui/button";

interface ReviewSummaryProps {
  /** Verses that made progress this session (cleared from the due queue). */
  reviewed: number;
  /** Verses that left today's due queue (rescheduled into the future). */
  cleared: number;
  /** Verses still due right now (0 == fully caught up). */
  remaining: number;
  onDone: () => void;
  /** Offered only when there is still due work to keep going on. */
  onContinue?: () => void;
  /** Label for the primary "done" action. Defaults to "Back to memory". */
  doneLabel?: string;
}

/**
 * End-of-queue card shown after a Review run: what got reviewed, what
 * cleared, and whether the learner is fully caught up.
 */
export function ReviewSummary({
  reviewed,
  cleared,
  remaining,
  onDone,
  onContinue,
  doneLabel = "Back to memory",
}: ReviewSummaryProps): JSX.Element {
  const caughtUp = remaining === 0;

  return (
    <MemoryDashboardCard className="mx-auto w-full max-w-md p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {caughtUp ? (
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
          )}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {caughtUp ? "All caught up!" : "Review complete"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {caughtUp
            ? "You've cleared today's review queue."
            : `${remaining} verse${remaining !== 1 ? "s" : ""} still due today.`}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Reviewed" value={reviewed} />
          <Stat label="Cleared" value={cleared} />
        </div>

        <div className="flex flex-col gap-2">
          {!caughtUp && onContinue && (
            <Button onClick={onContinue} className="w-full gap-2">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Keep reviewing
            </Button>
          )}
          <Button
            variant={caughtUp || !onContinue ? "default" : "outline"}
            onClick={onDone}
            className="w-full"
          >
            {doneLabel}
          </Button>
        </div>
      </div>
    </MemoryDashboardCard>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
