import type { JSX } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";

import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import type { CardReference } from "@/components/study/study-card-model";
import { Button } from "@/components/ui/button";
import { memoryPracticeSearch } from "@/lib/memory-practice-search";
import { formatVerseRef } from "@/lib/verse-ref-utils";

export interface ReviewSessionAttempt {
  reference: CardReference;
  accuracy: number;
}

interface ReviewSummaryProps {
  /** Graded verses from this review run, in session order. */
  attempts: ReviewSessionAttempt[];
  /** Mean accuracy across graded attempts, or null when none were graded. */
  averageAccuracy: number | null;
  /** Verses still due right now (0 == fully caught up). */
  remaining: number;
  onDone: () => void;
  /** Offered only when there is still due work to keep going on. */
  onContinue?: () => void;
  /** Label for the primary "done" action. Defaults to "Back to memory". */
  doneLabel?: string;
}

/**
 * End-of-queue card shown after a Review run: session accuracy, per-verse
 * results, and a quick path into practice for any verse that needs work.
 */
export function ReviewSummary({
  attempts,
  averageAccuracy,
  remaining,
  onDone,
  onContinue,
  doneLabel = "Back to memory",
}: ReviewSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const caughtUp = remaining === 0;
  const hasAttempts = attempts.length > 0;

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
          {!hasAttempts
            ? "No verses were graded in this session."
            : caughtUp
              ? "You've cleared today's review queue."
              : `${remaining} verse${remaining !== 1 ? "s" : ""} still due today.`}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {averageAccuracy !== null && (
          <div className="rounded-lg border bg-background/60 px-3 py-4">
            <p className="text-3xl font-semibold tabular-nums">
              {averageAccuracy}%
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Average accuracy
            </p>
          </div>
        )}

        {hasAttempts && (
          <ul className="divide-y rounded-lg border text-left">
            {attempts.map((attempt) => {
              const label = formatVerseRef(attempt.reference);
              return (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {attempt.accuracy}% recalled
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      void navigate({
                        to: "/memory/practice",
                        search: memoryPracticeSearch(attempt.reference),
                      });
                    }}
                  >
                    Practice
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

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
