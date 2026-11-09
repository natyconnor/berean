import type { JSX } from "react";
import { Check } from "lucide-react";

import { FirstMemorizedBanner } from "@/components/memory/celebrate/first-memorized-banner";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import {
  AccuracyScore,
  ReviewResultRows,
} from "@/components/memory/review-summary";
import {
  SESSION_COMPLETE_FOOTER,
  SESSION_COMPLETE_TITLE,
} from "@/lib/memory-copy";
import { todaySessionDoneLine } from "@/lib/memory-today-session";
import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
  type ReviewSessionAttempt,
} from "@/lib/review-session-attempts";

import {
  SessionCompleteRows,
  SessionSummaryActions,
  type SessionCompleteVerse,
} from "./session-complete";

interface TodaySessionSummaryProps {
  /** The session's header title, kept for coming back from a summary Refresh. */
  title: string;
  /** Passages that took today's step, by title. */
  passages: readonly string[];
  /** Verses from the learning part, with where each landed. */
  learned: ReadonlyArray<SessionCompleteVerse>;
  /** Grades from the review part. */
  attempts: ReviewSessionAttempt[];
  onDone: () => void;
  /** Shows a ghost Extra practice beside Done. */
  extraPracticeHref?: string;
  /** Carried into each reviewed verse's Practice session. */
  returnTo?: string;
}

/** One summary for the whole blended session: passages, learning, reviews. */
export function TodaySessionSummary({
  title,
  passages,
  learned,
  attempts,
  onDone,
  extraPracticeHref,
  returnTo,
}: TodaySessionSummaryProps): JSX.Element {
  const reviews = groupReviewSessionAttempts(attempts).length;
  // Every unhinted counted try; First letters and practice never reach here.
  const averageAccuracy = averageReviewAccuracy(attempts);
  return (
    <MemoryDashboardCard className="mx-auto w-full max-w-lg p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">
            {SESSION_COMPLETE_TITLE}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {todaySessionDoneLine({
              passages,
              learningSteps: learned.length,
              reviews,
            })}{" "}
            {SESSION_COMPLETE_FOOTER}
          </p>
        </div>
      </div>

      <FirstMemorizedBanner verses={learned} className="mt-5" />

      <div className="mt-6 space-y-3">
        {averageAccuracy !== null ? (
          <div className="text-center">
            <AccuracyScore
              accuracy={averageAccuracy}
              label="Average accuracy"
            />
          </div>
        ) : null}
        {passages.length > 0 ? (
          <ul className="divide-y rounded-lg border text-left">
            {passages.map((title) => (
              <li
                key={title}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <p className="min-w-0 truncate text-sm font-medium">{title}</p>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  Today&apos;s verses done
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {learned.length > 0 ? <SessionCompleteRows verses={learned} /> : null}
        {attempts.length > 0 ? (
          <ReviewResultRows
            attempts={attempts}
            returnTo={returnTo}
            summary={{
              kind: "today",
              title,
              passages,
              learned,
              attempts,
              extraPracticeHref,
            }}
          />
        ) : null}
      </div>

      <SessionSummaryActions
        exitLabel="Done"
        onExit={onDone}
        extraPracticeHref={extraPracticeHref}
        className="mt-6"
      />
    </MemoryDashboardCard>
  );
}
