import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { MAX_LEARN_STAGE, type MemoryStatus } from "@/lib/memory-scheduler";
import { linePath, scaleLinear } from "./dashboard/svg-chart-helpers";
import { AddToPack } from "./packs/add-to-pack";

const STAGE_LABELS = ["Full", "First letters", "Cloze", "Hidden"] as const;

const STATUS_LABELS: Record<MemoryStatus, string> = {
  new: "New",
  learning: "Learning",
  reviewing: "Reviewing",
  mastered: "Mastered",
};

const SPARK_W = 280;
const SPARK_H = 64;
const SPARK_PAD = 6;

/** Human "next due" label relative to `now`. */
function formatDueLabel(dueAt: number, now: number): string {
  const diff = dueAt - now;
  if (diff <= 0) return "Due now";
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

/**
 * Per-verse drill-down: the live schedule, a stage journey, an attempt
 * sparkline (accuracy over time), and a derived difficulty signal. Fetches its
 * own data via `verseMemory.verseDetail`.
 */
export function VerseDetail({
  verseRefId,
  now,
}: {
  verseRefId: Id<"verseRefs">;
  now: number;
}) {
  const detail = useQuery(api.verseMemory.verseDetail, { verseRefId, now });

  if (detail === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No memory record for this verse yet.
      </p>
    );
  }

  const reference = formatVerseRef({
    book: detail.book,
    chapter: detail.chapter,
    startVerse: detail.startVerse,
    endVerse: detail.endVerse,
  });

  // Attempts arrive newest-first; reverse for a left-to-right time axis.
  const chronological = [...detail.attempts].reverse();
  const sparkPoints = chronological.map((a, i) => ({
    x:
      chronological.length <= 1
        ? SPARK_W / 2
        : scaleLinear(
            i,
            0,
            chronological.length - 1,
            SPARK_PAD,
            SPARK_W - SPARK_PAD,
          ),
    y: scaleLinear(a.accuracy, 0, 100, SPARK_H - SPARK_PAD, SPARK_PAD),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">
            {reference}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {STATUS_LABELS[detail.status]} · {formatDueLabel(detail.dueAt, now)}
          </p>
        </div>
        <AddToPack
          reference={{
            book: detail.book,
            chapter: detail.chapter,
            startVerse: detail.startVerse,
            endVerse: detail.endVerse,
          }}
          now={now}
        />
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
            Graduated to review — recalled from hidden.
          </p>
        ) : null}
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
        ) : (
          <svg
            role="img"
            aria-label={`Accuracy across the last ${sparkPoints.length} attempts.`}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            preserveAspectRatio="none"
            className="h-16 w-full"
          >
            <line
              x1={0}
              y1={scaleLinear(50, 0, 100, SPARK_H - SPARK_PAD, SPARK_PAD)}
              x2={SPARK_W}
              y2={scaleLinear(50, 0, 100, SPARK_H - SPARK_PAD, SPARK_PAD)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            {sparkPoints.length === 1 ? (
              <circle
                cx={sparkPoints[0].x}
                cy={sparkPoints[0].y}
                r={3}
                fill="var(--chart-1)"
              />
            ) : (
              <path
                d={linePath(sparkPoints)}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
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

function formatInterval(days: number): string {
  if (days <= 0) return "—";
  if (days < 1) return "<1d";
  return `${Math.round(days)}d`;
}
