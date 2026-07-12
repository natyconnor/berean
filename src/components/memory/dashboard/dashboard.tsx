import { Loader2, Play } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { computeStreak, overallAccuracy } from "@/lib/dashboard-buckets";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { KpiRow } from "./kpi-row";
import { PracticeHeatmap } from "./practice-heatmap";
import { MasteryBar } from "./mastery-bar";
import { AccuracyTrend } from "./accuracy-trend";
import { ReviewForecast } from "./review-forecast";

const HEATMAP_DAYS = 84; // 12 weeks
const TREND_DAYS = 30;
const FORECAST_DAYS = 14;

type MemoryStats = FunctionReturnType<typeof api.verseMemory.memoryStats>;

/**
 * The Memory progress dashboard: a "Today" hero (keeping Review reachable),
 * a KPI row, and inline SVG/CSS charts. All data is real and reactive; `now` is
 * supplied by the caller (never `Date.now()` inside Convex). Day buckets use
 * the viewer's IANA timezone so streaks and heatmaps follow local midnights.
 *
 * Each section loads independently — the Today hero + Review render as
 * soon as `memoryStats` (the due count) resolves, so the primary review action
 * is never blocked on the heatmap/trend/forecast/distribution aggregates.
 */
export function MemoryDashboard({
  now,
  stats,
  onStartReview,
}: {
  now: number;
  stats: MemoryStats | undefined;
  onStartReview: () => void;
}) {
  const timeZone = getViewerTimeZone();
  const activity = useQuery(api.verseMemory.reviewActivity, {
    now,
    timeZone,
    heatmapDays: HEATMAP_DAYS,
    trendDays: TREND_DAYS,
  });
  const forecast = useQuery(api.verseMemory.reviewForecast, {
    now,
    timeZone,
    days: FORECAST_DAYS,
  });

  const streak =
    activity === undefined
      ? undefined
      : computeStreak(activity.heatmap.map((d) => d.count));
  const inMemory =
    stats === undefined
      ? undefined
      : stats.learning + stats.reviewing + stats.mastered;
  const accuracy30d =
    activity === undefined
      ? undefined
      : overallAccuracy(
          activity.trend.map((d) => ({ average: d.average, count: d.count })),
        );

  return (
    <div className="space-y-4">
      {/* Header band: the Today hero and the KPI cluster share a row on large
          screens so the top of the page stops being a near-empty wide card. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-center">
        <TodayHero due={stats?.due} onStartReview={onStartReview} />
        <div className="lg:col-span-2">
          <KpiRow
            kpis={{
              dueToday: stats?.due,
              streak,
              inMemory,
              accuracy30d,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {activity === undefined ? (
          <ChartSkeleton title="Practice" />
        ) : (
          <PracticeHeatmap data={activity.heatmap} />
        )}
        {stats === undefined ? (
          <ChartSkeleton title="Mastery" />
        ) : (
          <MasteryBar data={stats} />
        )}
        {activity === undefined ? (
          <ChartSkeleton title="Accuracy trend" />
        ) : (
          <AccuracyTrend data={activity.trend} />
        )}
        {forecast === undefined ? (
          <ChartSkeleton title="Upcoming" />
        ) : (
          <ReviewForecast data={forecast} />
        )}
      </div>
    </div>
  );
}

/**
 * The "Today" hero. `due === undefined` means `memoryStats` is still loading;
 * we show a spinner but keep the section mounted so it doesn't jump. Once the
 * count resolves, Start review is enabled iff something is due.
 */
function TodayHero({
  due,
  onStartReview,
}: {
  due: number | undefined;
  onStartReview: () => void;
}) {
  if (due === undefined) {
    return (
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Today
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {due > 0 ? `${due} due today` : "All caught up"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {due > 0
              ? "Review your hearted verses across every session."
              : "No verses are due for review right now."}
          </p>
        </div>
        <Button
          size="lg"
          onClick={onStartReview}
          disabled={due === 0}
          className="gap-1.5"
        >
          <Play className="h-4 w-4" />
          Review
        </Button>
      </div>
    </section>
  );
}

/** Placeholder card shown in a chart slot while its aggregate query loads. */
function ChartSkeleton({ title }: { title: string }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 flex h-24 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    </section>
  );
}
