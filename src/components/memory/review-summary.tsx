import { type JSX, type RefObject, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { REFRESHER_LINK_CLASS } from "@/components/memory/memory-refresher-controls";
import { RefreshStartError } from "@/components/memory/memory-restart-menu";
import { AddToPack } from "@/components/memory/packs/add-to-pack";
import { LearningJourneyBar } from "@/components/memory/practice/learning-journey-bar";
import { SessionSummaryActions } from "@/components/memory/practice/session-complete";
import type { CardReference } from "@/components/study/study-card-model";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  type SessionSummarySnapshot,
  useRefreshReturnFocus,
  useStartPassageRefresh,
  useStartVerseRefresh,
} from "@/hooks/use-start-verse-refresh";
import { formatDueDay } from "@/lib/memorize-plan";
import { MEMORY_HOME } from "@/lib/memory-exit";
import { REFRESH_MENU_LABEL } from "@/lib/memory-copy";
import { memoryPracticeSearch } from "@/lib/memory-practice-search";
import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
  offersPassageSummaryRefresh,
  offersSummaryRefresh,
  recalledCopy,
  refresherResultCopy,
  type ReviewSessionAttempt,
} from "@/lib/review-session-attempts";
import type { PassageStatus } from "@/lib/passage-heart-info";
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
          <AccuracyScore accuracy={averageAccuracy} label="Average accuracy" />
        )}

        {hasAttempts && (
          <ReviewResultRows
            attempts={attempts}
            returnTo={returnTo}
            summary={{
              kind: "review",
              attempts,
              averageAccuracy,
              remaining,
              doneLabel,
              extraPracticeHref,
              canContinue: onContinue !== undefined,
            }}
          />
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

/** What a passage summary needs to offer its Refresh (R51). */
export type PassageSummaryRefreshSource = {
  packId: string;
  references: readonly CardReference[];
  /** The status the counted tries saved. */
  status?: PassageStatus;
  /** Where the refresher's Home link points. */
  returnTo: string;
};

/**
 * End of a standalone passage review: its score and when it comes back. One
 * passage, so no queue claim, mastery bar or extra actions. A miss that left
 * it Memorized gets a practice-only Refresh (R51).
 */
export function PassageReviewSummary({
  title,
  attempts,
  dueAt,
  onDone,
  refresh,
  restored = false,
}: {
  title: string;
  /**
   * Counted tries in session order, as a verse session records them. Their
   * mean is the accuracy; a refresher shows both tries like a verse row.
   */
  attempts: ReviewSessionAttempt[];
  /** Next review from the saved schedule. */
  dueAt: number;
  onDone: () => void;
  refresh?: PassageSummaryRefreshSource;
  /** Shown again after a summary Refresh, which focuses its Refresh instead. */
  restored?: boolean;
}): JSX.Element {
  const now = useLiveNow();
  const [row] = groupReviewSessionAttempts(attempts);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const refreshable =
    refresh !== undefined &&
    offersPassageSummaryRefresh(attempts, refresh.status);

  useEffect(() => {
    if (!restored) headingRef.current?.focus();
  }, [restored]);

  return (
    <MemoryDashboardCard className="mx-auto w-full max-w-md p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          Review complete
        </h2>
      </div>

      <div className="mt-6 space-y-6">
        <AccuracyScore
          accuracy={averageReviewAccuracy(attempts) ?? 0}
          label="Accuracy"
        />
        <ul className="divide-y rounded-lg border text-left">
          <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div className={cn("min-w-0 flex-1", refreshable && "basis-40")}>
              <p className="text-sm font-medium break-words">{title}</p>
              {row?.refresherUsed ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {refresherResultCopy(row.accuracies)}
                </p>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Next review {formatDueDay(dueAt, now)}
              </p>
            </div>
            {refreshable ? (
              <PassageSummaryRefresh
                source={refresh}
                label={title}
                snapshot={{
                  kind: "passage",
                  packId: refresh.packId,
                  title,
                  attempts,
                  dueAt,
                  status: refresh.status,
                }}
              />
            ) : null}
          </li>
        </ul>
        <SessionSummaryActions exitLabel="Done" onExit={onDone} />
      </div>
    </MemoryDashboardCard>
  );
}

/**
 * Passage summary Refresh: practice only, since today's miss is already
 * counted. The summary is kept on its history entry, so Continue and Back come
 * back to it and focus this control. The error shows under the row (R34).
 */
function PassageSummaryRefresh({
  source,
  label,
  snapshot,
}: {
  source: PassageSummaryRefreshSource;
  label: string;
  snapshot: SessionSummarySnapshot;
}): JSX.Element {
  const href = useLocation({ select: (location) => location.href });
  const refresh = useStartPassageRefresh(
    source.packId,
    source.references,
    source.returnTo,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  useRefreshReturnFocus({ packId: source.packId }, buttonRef);

  return (
    <>
      <RefreshLinkButton
        buttonRef={buttonRef}
        label={`${REFRESH_MENU_LABEL} ${label}`}
        pending={refresh.pending}
        onClick={() => refresh.start(false, { href, snapshot })}
      />
      <RefreshStartError
        error={refresh.error}
        className="order-last basis-full text-right"
      />
    </>
  );
}

function AccuracyScore({
  accuracy,
  label,
}: {
  accuracy: number;
  label: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-4">
      <p className="text-3xl font-semibold tabular-nums">{accuracy}%</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/**
 * Each reviewed verse with how well it was recalled, and Add to pack and
 * Practice shortcuts. A pack recited as one passage gets neither. A verse
 * still Memorized whose last try here was under 85% also gets Refresh (R21).
 */
export function ReviewResultRows({
  attempts,
  returnTo,
  summary,
  className,
}: {
  attempts: ReviewSessionAttempt[];
  returnTo?: string;
  /** The summary these rows sit in, kept for coming back from Refresh. */
  summary: SessionSummarySnapshot;
  className?: string;
}): JSX.Element {
  const navigate = useNavigate();
  const now = useLiveNow();

  return (
    <ul className={cn("divide-y rounded-lg border text-left", className)}>
      {groupReviewSessionAttempts(attempts).map((attempt) => {
        const label = attempt.label ?? formatVerseRefTitle(attempt.reference);
        const refreshable = offersSummaryRefresh(attempt);
        return (
          <li
            key={label}
            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className={cn("min-w-0 flex-1", refreshable && "basis-40")}>
              <p className="truncate text-sm font-medium">{label}</p>
              {attempt.schedule ? (
                <div className="mt-1.5 space-y-1">
                  <LearningJourneyBar
                    learnStage={attempt.schedule.learnStage}
                    stageReps={attempt.schedule.stageReps}
                    status={attempt.schedule.status}
                    intervalDays={attempt.schedule.intervalDays}
                    ease={attempt.schedule.ease}
                  />
                  {attempt.refresherUsed ? (
                    <p className="text-xs text-muted-foreground">
                      {refresherResultCopy(attempt.accuracies)}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Next review {formatDueDay(attempt.schedule.dueAt, now)}
                  </p>
                </div>
              ) : (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {recalledCopy(attempt.accuracies)}
                </p>
              )}
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
              {attempt.label === undefined ? (
                <AddToPack
                  reference={attempt.reference}
                  now={now}
                  variant="icon"
                />
              ) : null}
              {refreshable ? (
                <SummaryRefresh
                  reference={attempt.reference}
                  label={label}
                  returnTo={returnTo}
                  summary={summary}
                />
              ) : null}
              {attempt.offerPractice === false ? null : (
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

/**
 * Summary Refresh: practice only, since today's miss is already counted. The
 * summary is kept on its history entry, so Continue and Back come back to it
 * and focus this control. The error shows under the row's actions (R34).
 */
function SummaryRefresh({
  reference,
  label,
  returnTo,
  summary,
}: {
  reference: CardReference;
  label: string;
  returnTo?: string;
  summary: SessionSummarySnapshot;
}): JSX.Element {
  const href = useLocation({ select: (location) => location.href });
  const refresh = useStartVerseRefresh(reference, returnTo ?? MEMORY_HOME);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useRefreshReturnFocus(reference, buttonRef);

  return (
    <>
      <RefreshLinkButton
        buttonRef={buttonRef}
        label={`${REFRESH_MENU_LABEL} ${label}`}
        pending={refresh.pending}
        onClick={() => refresh.start(false, { href, snapshot: summary })}
      />
      <RefreshStartError
        error={refresh.error}
        className="order-last basis-full text-right"
      />
    </>
  );
}

/** The quiet Lightbulb Refresh on a summary row. */
function RefreshLinkButton({
  buttonRef,
  label,
  pending,
  onClick,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  label: string;
  pending: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={REFRESHER_LINK_CLASS}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Lightbulb className="size-3.5" aria-hidden />
      )}
      {REFRESH_MENU_LABEL}
    </button>
  );
}
