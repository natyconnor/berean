import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import {
  areaPath,
  chartColor,
  linePath,
  practiceCellStyle,
} from "@/components/memory/dashboard/svg-chart-helpers";
import { InternalLink } from "@/components/memory/internal-link";
import {
  useProgressActivity,
  type ReviewActivity,
} from "@/components/memory/progress/use-progress-activity";
import type { TodayModelResult } from "@/hooks/use-today-model";
import { computeStreak, overallAccuracy } from "@/lib/dashboard-buckets";
import { YOUR_PROGRESS_LABEL, YOUR_VERSES_LABEL } from "@/lib/memory-copy";
import { memoryPanelDrawerHref } from "@/lib/memory-panel";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { todayWorkCount } from "@/lib/memory-today";
import {
  practicedDaysCopy,
  practicedDaysIn,
  streakCopy,
  type StreakCopy,
} from "@/lib/streak-copy";
import { cn } from "@/lib/utils";

const PROGRESS_HREF = memoryPanelDrawerHref({ kind: "progress" });
const VERSES_HREF = memoryPanelDrawerHref({ kind: "verses" });

const STRIP_DAYS = 14;
/** Accuracy reads as noise before this many graded answers. */
const MIN_ACCURACY_ANSWERS = 5;

const eyebrowClassName =
  "text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Your progress and Your verses: two compact doorways into their drawers. */
export function DoorwayCards({
  today,
  now,
}: {
  today: TodayModelResult;
  now: number;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-1 md:grid-rows-2">
      <ProgressDoorway now={now} />
      <VersesDoorway today={today} />
    </div>
  );
}

function DoorwayCard({
  href,
  eyebrow,
  ariaLabel,
  children,
}: {
  href: string;
  eyebrow: string;
  ariaLabel: string | undefined;
  children: ReactNode;
}) {
  return (
    <InternalLink
      href={href}
      aria-label={ariaLabel}
      className="group flex min-w-0 flex-col justify-between gap-1.5 rounded-xl border bg-card px-3.5 py-2.5 shadow-sm outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={eyebrowClassName}>{eyebrow}</span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
        />
      </div>
      {children}
    </InternalLink>
  );
}

interface ProgressSummary {
  practicedDays: number;
  /** Shown in place of `practicedDays` once it's 2+ days. */
  streak: StreakCopy | null;
  /** Rounded percent, or `null` until there are enough answers. */
  accuracy: number | null;
  strip: ReviewActivity["heatmap"];
  /** Day averages with answers, oldest first, as index within the trend window. */
  spark: { index: number; average: number }[];
  trendDays: number;
}

function summarizeProgress(activity: ReviewActivity): ProgressSummary {
  const dailyCounts = activity.heatmap.map((day) => day.count);
  const answers = activity.trend.reduce((sum, day) => sum + day.count, 0);
  const accuracy =
    answers >= MIN_ACCURACY_ANSWERS ? overallAccuracy(activity.trend) : null;
  return {
    practicedDays: practicedDaysIn(dailyCounts, STRIP_DAYS),
    streak: streakCopy(computeStreak(dailyCounts).days),
    accuracy: accuracy === null ? null : Math.round(accuracy),
    strip: activity.heatmap.slice(-STRIP_DAYS),
    spark: activity.trend.flatMap((day, index) =>
      day.average !== null && day.count > 0
        ? [{ index, average: day.average }]
        : [],
    ),
    trendDays: activity.trend.length,
  };
}

function progressStatText(summary: ProgressSummary): string {
  const practiced =
    summary.streak?.sentence ??
    practicedDaysCopy(summary.practicedDays, STRIP_DAYS);
  return summary.accuracy === null
    ? practiced
    : `${practiced} · ${summary.accuracy}% accuracy`;
}

function ProgressDoorway({ now }: { now: number }) {
  const { activity } = useProgressActivity(now);
  const summary = activity ? summarizeProgress(activity) : null;

  return (
    <DoorwayCard
      href={PROGRESS_HREF}
      eyebrow={YOUR_PROGRESS_LABEL}
      ariaLabel={
        summary
          ? `${YOUR_PROGRESS_LABEL}: ${progressStatText(summary)}`
          : YOUR_PROGRESS_LABEL
      }
    >
      {summary ? (
        <>
          <p className="text-[13px] leading-snug">
            {summary.streak ? (
              <>
                <b className="font-semibold">{summary.streak.label}</b>
                {summary.streak.note ? `. ${summary.streak.note}` : null}
              </>
            ) : summary.practicedDays > 0 ? (
              <>
                Practiced{" "}
                <b className="font-semibold">
                  {summary.practicedDays} of the last {STRIP_DAYS} days
                </b>
              </>
            ) : (
              practicedDaysCopy(0, STRIP_DAYS)
            )}
            {summary.accuracy !== null ? (
              <>
                {" · "}
                <b className="font-semibold">{summary.accuracy}%</b> accuracy
              </>
            ) : null}
          </p>
          <div className="flex items-end justify-between gap-3">
            <PracticeStrip days={summary.strip} />
            <AccuracySparkline
              points={summary.spark}
              trendDays={summary.trendDays}
            />
          </div>
        </>
      ) : (
        <div aria-hidden className="space-y-2">
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-28 animate-pulse rounded bg-muted" />
        </div>
      )}
    </DoorwayCard>
  );
}

function PracticeStrip({ days }: { days: ReviewActivity["heatmap"] }) {
  const max = days.reduce((most, day) => Math.max(most, day.count), 0);
  return (
    <span aria-hidden className="flex gap-[2px] sm:gap-[3px]">
      {days.map((day) => (
        <span
          key={day.dayStart}
          className="size-[7px] rounded-[2px] sm:size-2.5"
          style={practiceCellStyle(day.count, max)}
        />
      ))}
    </span>
  );
}

const SPARK_WIDTH = 90;
const SPARK_HEIGHT = 28;

function AccuracySparkline({
  points,
  trendDays,
}: {
  points: ProgressSummary["spark"];
  trendDays: number;
}) {
  if (points.length < 2) return null;
  const averages = points.map((point) => point.average);
  const low = Math.min(...averages);
  const high = Math.max(...averages);
  const span = Math.max(high - low, 4);
  const lastIndex = Math.max(trendDays - 1, 1);
  const coords = points.map((point) => ({
    x: Number(((point.index / lastIndex) * SPARK_WIDTH).toFixed(1)),
    y: Number(
      (
        SPARK_HEIGHT -
        2 -
        ((point.average - low) / span) * (SPARK_HEIGHT - 6)
      ).toFixed(1),
    ),
  }));
  const last = coords[coords.length - 1];
  const color = chartColor(1);

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      width={72}
      height={22}
      className="hidden min-w-0 shrink sm:block"
    >
      <path
        d={areaPath(coords, SPARK_HEIGHT)}
        fill={color}
        fillOpacity={0.15}
      />
      <path
        d={linePath(coords)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}

function VersesDoorway({ today }: { today: TodayModelResult }) {
  const total = today.totalInMemory;
  const work = todayWorkCount(today.counts);
  const passages = today.goals.filter((goal) => goal.kind === "passage").length;
  const countLabel =
    total > 0 ? plural(total, "verse") : plural(passages, "passage");
  const dueLabel =
    today.state === "caughtUp"
      ? "all done today"
      : work > 0
        ? `${work} due today`
        : null;

  const { learning, memorized, mastered } = today.statusCounts;
  const statusTotal = learning + memorized + mastered;
  const segments = [
    { status: "learning" as const, count: learning, label: "learning" },
    { status: "reviewing" as const, count: memorized, label: "memorized" },
    { status: "mastered" as const, count: mastered, label: "mastered" },
  ];

  return (
    <DoorwayCard
      href={VERSES_HREF}
      eyebrow={YOUR_VERSES_LABEL}
      ariaLabel={`${YOUR_VERSES_LABEL}: ${countLabel}${dueLabel ? `, ${dueLabel}` : ""}`}
    >
      <p className="text-[13px] leading-snug">
        <b className="font-semibold">{countLabel}</b>
        {today.state === "caughtUp" ? (
          " · all done today"
        ) : work > 0 ? (
          <>
            {" · "}
            <b className="font-semibold">{work}</b> due today
          </>
        ) : null}
      </p>
      {statusTotal > 0 ? (
        <div>
          <div
            aria-hidden
            className="flex h-1.5 overflow-hidden rounded-full bg-muted"
          >
            {segments.map((segment) =>
              segment.count > 0 ? (
                <span
                  key={segment.status}
                  className={cn(
                    "h-full",
                    MEMORY_STATUS_STYLE[segment.status].bar,
                  )}
                  style={{ width: `${(segment.count / statusTotal) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div
            aria-hidden
            className="mt-1.5 hidden flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground sm:flex"
          >
            {segments.map((segment) => (
              <span
                key={segment.status}
                className="inline-flex items-center gap-1.5"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    MEMORY_STATUS_STYLE[segment.status].dot,
                  )}
                />
                {segment.count} {segment.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </DoorwayCard>
  );
}
