import { Dumbbell, Play } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatMemoryStatusSubtitle } from "@/lib/memory-due-label";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import {
  isReviewPhase,
  MAX_LEARN_STAGE,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import type { VerseAttemptQuality } from "@/components/study/study-attempt-quality";
import { linePath, scaleLinear } from "./dashboard/svg-chart-helpers";
import { AddToPack } from "./packs/add-to-pack";
import { LearningJourneyBar } from "./practice/learning-journey-bar";
import type { PracticeVerse } from "./practice/practice-board";
import { PRACTICE_STAGES } from "./practice/practice-stages";

/**
 * Learn-band labels, sourced from the shared support bands (Read / Guided /
 * Challenge / From Memory) so the drill-down never drifts from the scheduler's
 * naming.
 */
const STAGE_LABELS = PRACTICE_STAGES.map((s) => s.label);

const STATUS_LABELS: Record<MemoryStatus, string> = {
  new: "New",
  learning: "Learning",
  reviewing: "Reviewing",
  mastered: "Mastered",
};

const QUALITY_LABELS: Record<VerseAttemptQuality, string> = {
  exact: "Exact",
  close: "Close",
  off: "Off",
};

const SPARK_W = 280;
const SPARK_H = 64;
const SPARK_PAD = 6;

/**
 * Layout-stable placeholder that mirrors the loaded verse-detail body so the
 * dialog does not resize when the query resolves.
 */
function VerseDetailSkeleton() {
  return (
    <div
      className="space-y-5"
      aria-busy="true"
      aria-label="Loading verse detail"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-8 w-[5.25rem] animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-[7.25rem] animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["Interval", "Ease", "Lapses"] as const).map((label) => (
          <div key={label} className="rounded-lg border bg-card px-2 py-2">
            <div className="mx-auto h-5 w-10 animate-pulse rounded bg-muted" />
            <p className="mt-1 text-center text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Stage journey
        </h4>
        <ol className="flex items-center gap-1.5">
          {STAGE_LABELS.map((label) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-1">
              <span
                aria-hidden
                className="h-1.5 w-full animate-pulse rounded-full bg-muted"
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-8 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recent accuracy
          </h4>
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-1.5">
          <div className="relative w-7 shrink-0" aria-hidden>
            {[100, 50, 0].map((pct) => (
              <span
                key={pct}
                className="absolute right-0 -translate-y-1/2 text-[9px] leading-none text-muted-foreground tabular-nums"
                style={{
                  top: scaleLinear(pct, 0, 100, SPARK_H - SPARK_PAD, SPARK_PAD),
                }}
              >
                {pct}%
              </span>
            ))}
          </div>
          <div className="h-16 w-full animate-pulse rounded bg-muted" />
        </div>
      </section>

      <section className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Difficulty
        </h4>
        <div className="space-y-1.5">
          <div className="h-4 w-full max-w-[16rem] animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </section>
    </div>
  );
}

/**
 * Per-verse drill-down: the live schedule, a stage journey, an attempt
 * sparkline (accuracy over time), and a derived difficulty signal. Fetches its
 * own data via `verseMemory.verseDetail`.
 */
export function VerseDetail({
  verseRefId,
  now,
  onPractice,
  onReview,
}: {
  verseRefId: Id<"verseRefs">;
  now: number;
  /** Start practice for this verse (closes the detail dialog upstream). */
  onPractice: (verse: PracticeVerse) => void;
  /** Start review for this verse when it is due. */
  onReview?: (verse: PracticeVerse) => void;
}) {
  const detail = useQuery(api.verseMemory.verseDetail, {
    verseRefId,
    now,
  });

  if (detail === undefined) {
    return <VerseDetailSkeleton />;
  }

  if (detail === null) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No memory record for this verse yet.
      </p>
    );
  }

  const cardReference = {
    book: detail.book,
    chapter: detail.chapter,
    startVerse: detail.startVerse,
    endVerse: detail.endVerse,
  };
  const reference = formatVerseRef(cardReference);
  const actionVerse: PracticeVerse = {
    reference: cardReference,
    learnStage: detail.learnStage,
    stageReps: detail.stageReps,
    status: detail.status,
  };
  const showReviewAction =
    onReview !== undefined && isReviewPhase(detail.status) && detail.isDue;

  // Attempts arrive newest-first; reverse for a left-to-right time axis.
  const chronological = [...detail.attempts].reverse();
  const latestAttempt = detail.attempts[0];
  const yFor = (pct: number) =>
    scaleLinear(pct, 0, 100, SPARK_H - SPARK_PAD, SPARK_PAD);
  const sparkPoints = chronological.map((a, i) => ({
    x: scaleLinear(
      i,
      0,
      chronological.length - 1,
      SPARK_PAD,
      SPARK_W - SPARK_PAD,
    ),
    y: yFor(a.accuracy),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">
            {reference}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatMemoryStatusSubtitle({
              status: detail.status,
              statusLabel: STATUS_LABELS[detail.status],
              dueAt: detail.dueAt,
              now,
            })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {showReviewAction ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => onReview?.(actionVerse)}
            >
              <Play className="h-4 w-4" aria-hidden />
              Review
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onPractice(actionVerse)}
            >
              <Dumbbell className="h-4 w-4" aria-hidden />
              Practice
            </Button>
          )}
          <AddToPack reference={cardReference} now={now} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Interval" value={formatInterval(detail.intervalDays)} />
        <Stat label="Ease" value={detail.ease.toFixed(2)} />
        <Stat label="Lapses" value={String(detail.lapses)} />
      </div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Stage journey
        </h4>
        <ol className="flex items-center gap-1.5">
          {STAGE_LABELS.map((label, stage) => {
            const reached = detail.learnStage >= stage;
            const current =
              detail.learnStage === stage &&
              (detail.status === "new" || detail.status === "learning");
            return (
              <li
                key={label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span
                  aria-hidden
                  className={
                    "h-1.5 w-full rounded-full " +
                    (reached ? "bg-primary" : "bg-muted")
                  }
                />
                <span
                  className={
                    "text-[10px] " +
                    (current
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground")
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        {detail.status === "reviewing" || detail.status === "mastered" ? (
          <p className="text-xs text-muted-foreground">
            Graduated to review — recalled from memory.
          </p>
        ) : (
          <LearningJourneyBar
            learnStage={detail.learnStage}
            stageReps={detail.stageReps}
          />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recent accuracy
          </h4>
          <span className="text-xs text-muted-foreground tabular-nums">
            {detail.attempts.length}{" "}
            {detail.attempts.length === 1 ? "attempt" : "attempts"}
          </span>
        </div>
        {sparkPoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attempts yet. Review this verse to see its history here.
          </p>
        ) : sparkPoints.length === 1 && latestAttempt !== undefined ? (
          <SingleAttemptAccuracy attempt={latestAttempt} />
        ) : (
          <div className="flex gap-1.5">
            <div className="relative w-7 shrink-0" aria-hidden>
              {[100, 50, 0].map((pct) => (
                <span
                  key={pct}
                  className="absolute right-0 -translate-y-1/2 text-[9px] leading-none text-muted-foreground tabular-nums"
                  style={{ top: yFor(pct) }}
                >
                  {pct}%
                </span>
              ))}
            </div>
            <svg
              role="img"
              aria-label={`Accuracy across the last ${sparkPoints.length} attempts.`}
              viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
              preserveAspectRatio="none"
              className="h-16 w-full"
            >
              {[0, 50, 100].map((pct) => {
                const y = yFor(pct);
                return (
                  <line
                    key={pct}
                    x1={0}
                    y1={y}
                    x2={SPARK_W}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray={pct === 50 ? "3 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              <path
                d={linePath(sparkPoints)}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}
      </section>

      <section className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Difficulty
        </h4>
        {detail.difficulty === null ? (
          <p className="text-sm text-muted-foreground">
            Not enough attempts to gauge difficulty yet.
          </p>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Average accuracy{" "}
              <span className="font-medium tabular-nums text-foreground">
                {Math.round(detail.difficulty.averageAccuracy)}%
              </span>{" "}
              · worst{" "}
              <span className="font-medium tabular-nums text-foreground">
                {Math.round(detail.difficulty.worstAccuracy)}%
              </span>
            </p>
            {detail.difficulty.hardestStage !== null ? (
              <p className="text-muted-foreground">
                Hardest stage:{" "}
                <span className="font-medium text-foreground">
                  {STAGE_LABELS[
                    Math.min(detail.difficulty.hardestStage, MAX_LEARN_STAGE)
                  ] ?? `Stage ${detail.difficulty.hardestStage}`}
                </span>
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground/80">
              Derived from stored accuracy per attempt; the app doesn&apos;t
              persist per-word diffs, so an exact hardest phrase isn&apos;t
              available.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-2 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/**
 * One attempt isn't a trend — show the result as a meter with quality/stage
 * context instead of a lonely sparkline point.
 */
function SingleAttemptAccuracy({
  attempt,
}: {
  attempt: {
    quality: VerseAttemptQuality;
    accuracy: number;
    stage: number;
    createdAt: number;
  };
}) {
  const stageLabel =
    STAGE_LABELS[Math.min(attempt.stage, MAX_LEARN_STAGE)] ??
    `Stage ${attempt.stage}`;
  const clamped = Math.max(0, Math.min(100, attempt.accuracy));

  return (
    <div
      className="space-y-2"
      role="img"
      aria-label={`${Math.round(attempt.accuracy)} percent accuracy, ${QUALITY_LABELS[attempt.quality]}, ${stageLabel}, ${formatRelativeTime(attempt.createdAt)}.`}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {Math.round(attempt.accuracy)}%
          </span>
          <span className="text-xs text-muted-foreground">
            {QUALITY_LABELS[attempt.quality]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {stageLabel} · {formatRelativeTime(attempt.createdAt)}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full bg-[var(--chart-1)]"
          style={{ width: `${clamped}%` }}
          aria-hidden
        />
      </div>
      <p className="text-[11px] text-muted-foreground/80">
        Practice again to see how accuracy trends over time.
      </p>
    </div>
  );
}

function formatInterval(days: number): string {
  if (days <= 0) return "—";
  if (days < 1) return "<1d";
  return `${Math.round(days)}d`;
}
