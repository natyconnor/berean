import type { JSX } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Lightbulb, RotateCcw, Sparkles } from "lucide-react";

import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { AddToPack } from "@/components/memory/packs/add-to-pack";
import { SessionSummaryActions } from "@/components/memory/practice/session-complete";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { REFRESH_LABEL } from "@/lib/memory-copy";
import { memoryLearnSearch } from "@/lib/memory-learn-search";
import { memoryPracticeSearch } from "@/lib/memory-practice-search";
import { isLearningPhase } from "@/lib/memory-scheduler";
import {
  groupReviewSessionAttempts,
  recalledCopy,
  slippedThisSession,
  type ReviewSessionAttempt,
} from "@/lib/review-session-attempts";
import { cn } from "@/lib/utils";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

export type { ReviewSessionAttempt };

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
  /** Label for the primary "done" action. Defaults to "Done". */
  doneLabel?: string;
  /** Shows a ghost Extra practice beside Done. */
  extraPracticeHref?: string;
  /** Carried into each verse's Practice session so it returns here too. */
  returnTo?: string;
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
  doneLabel = "Done",
  extraPracticeHref,
  returnTo,
}: ReviewSummaryProps): JSX.Element {
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
          <ReviewResultRows attempts={attempts} returnTo={returnTo} />
        )}

        <div className="flex flex-col gap-2">
          {!caughtUp && onContinue && (
            <Button onClick={onContinue} className="w-full gap-2">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Keep reviewing
            </Button>
          )}
          <SessionSummaryActions
            exitLabel={doneLabel}
            onExit={onDone}
            exitVariant={caughtUp || !onContinue ? "default" : "outline"}
            extraPracticeHref={extraPracticeHref}
          />
        </div>
      </div>
    </MemoryDashboardCard>
  );
}

/**
 * Each reviewed verse with how well it was recalled, and Add to pack and
 * Practice shortcuts. A pack recited as one passage gets neither.
 */
export function ReviewResultRows({
  attempts,
  returnTo,
  className,
}: {
  attempts: ReviewSessionAttempt[];
  returnTo?: string;
  className?: string;
}): JSX.Element {
  const navigate = useNavigate();
  const now = useLiveNow();

  return (
    <ul className={cn("divide-y rounded-lg border text-left", className)}>
      {groupReviewSessionAttempts(attempts).map((attempt) => {
        const label = attempt.label ?? formatVerseRefTitle(attempt.reference);
        return (
          <li
            key={label}
            className="flex items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {recalledCopy(attempt.accuracies)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {attempt.label === undefined ? (
                <AddToPack
                  reference={attempt.reference}
                  now={now}
                  variant="icon"
                />
              ) : null}
              {attempt.offerPractice === false ? null : slippedThisSession(
                  attempt.accuracies,
                ) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => {
                    const learning = isLearningPhase(
                      attempt.status ?? "reviewing",
                    );
                    void navigate({
                      to: learning ? "/memory/learn" : "/memory/practice",
                      search: {
                        ...(learning
                          ? memoryLearnSearch(attempt.reference)
                          : {
                              ...memoryPracticeSearch(attempt.reference),
                              refresh: true,
                            }),
                        ...(returnTo === undefined ? {} : { return: returnTo }),
                      },
                    });
                  }}
                >
                  <Lightbulb className="size-3.5" aria-hidden />
                  {REFRESH_LABEL}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigate({
                      to: "/memory/practice",
                      search: {
                        ...memoryPracticeSearch(attempt.reference),
                        ...(returnTo === undefined ? {} : { return: returnTo }),
                      },
                    });
                  }}
                >
                  Practice
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
