import { useEffect } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";
import type { DashboardKpis } from "@/components/memory/dashboard/kpi-row";
import { computeStreak, overallAccuracy } from "@/lib/dashboard-buckets";
import { practicedDaysIn } from "@/lib/streak-copy";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

const HEATMAP_DAYS = 365; // up to a year; the chart clips to available width
const TREND_DAYS = 30;
const FORECAST_DAYS = 14;

export type ReviewActivity = FunctionReturnType<
  typeof api.verseMemory.reviewActivity
>;
export type ReviewForecastDays = FunctionReturnType<
  typeof api.verseMemory.reviewForecast
>;
export type MemoryStats = FunctionReturnType<
  typeof api.verseMemory.memoryStats
>;
export type MemoryStatusCounts = FunctionReturnType<
  typeof api.verseMemory.memoryStatus
>;

/**
 * Practice history and the review forecast behind Your progress. Day buckets
 * use the viewer's IANA time zone so streaks and heatmaps follow local
 * midnights. Also asks Convex to backfill heatmap days and passage due rows.
 */
export function useProgressActivity(now: number): {
  activity: ReviewActivity | undefined;
  forecast: ReviewForecastDays | undefined;
} {
  const timeZone = getViewerTimeZone() ?? "UTC";
  const ensureReviewActivityDays = useMutation(
    api.verseMemory.ensureReviewActivityDays,
  );
  const ensurePassageDueBackfill = useMutation(
    api.passageMemory.ensureDueBackfill,
  );
  useEffect(() => {
    void ensureReviewActivityDays({ now, timeZone });
    void ensurePassageDueBackfill({ now });
  }, [ensureReviewActivityDays, ensurePassageDueBackfill, now, timeZone]);

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
  return { activity, forecast };
}

/** The four KPI numbers; each stays `undefined` until its query loads. */
export function progressKpis({
  activity,
  status,
  stats,
}: {
  activity: ReviewActivity | undefined;
  status: MemoryStatusCounts | undefined;
  stats: MemoryStats | undefined;
}): DashboardKpis {
  return {
    dueToday: stats === undefined ? undefined : stats.due + stats.learningDue,
    streak:
      activity === undefined
        ? undefined
        : computeStreak(activity.heatmap.map((d) => d.count)),
    practicedLastWeek:
      activity === undefined
        ? undefined
        : practicedDaysIn(activity.heatmap.map((d) => d.count)),
    inMemory:
      status === undefined
        ? undefined
        : status.learning + status.reviewing + status.mastered,
    accuracy30d:
      activity === undefined
        ? undefined
        : overallAccuracy(
            activity.trend.map((d) => ({ average: d.average, count: d.count })),
          ),
  };
}
