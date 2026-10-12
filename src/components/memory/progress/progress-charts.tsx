import { AccuracyTrend } from "@/components/memory/dashboard/accuracy-trend";
import {
  ChartSkeleton,
  ChartSlot,
  chartCardClassName,
} from "@/components/memory/dashboard/chart-card";
import { MasteryDonut } from "@/components/memory/dashboard/mastery-donut";
import { PracticeHeatmap } from "@/components/memory/dashboard/practice-heatmap";
import { ReviewForecast } from "@/components/memory/dashboard/review-forecast";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { cn } from "@/lib/utils";

import type {
  MemoryStatusCounts,
  ReviewActivity,
  ReviewForecastDays,
} from "./use-progress-activity";

/**
 * Practice, Mastery, Accuracy trend and Upcoming. Each chart loads into a
 * reserved slot on its own; `className` sets the grid columns. With
 * `placeholderWithoutPractice`, Practice and Accuracy trend show a one-line
 * placeholder until there is practice history.
 */
export function ProgressCharts({
  activity,
  forecast,
  status,
  className,
  placeholderWithoutPractice = false,
}: {
  activity: ReviewActivity | undefined;
  forecast: ReviewForecastDays | undefined;
  status: MemoryStatusCounts | undefined;
  className?: string;
  placeholderWithoutPractice?: boolean;
}) {
  const showPlaceholder =
    placeholderWithoutPractice &&
    activity !== undefined &&
    !activity.heatmap.some((day) => day.count > 0);

  return (
    <div className={cn("grid gap-4", className)}>
      <ChartSlot
        loading={activity === undefined}
        skeleton={<ChartSkeleton title="Practice" />}
      >
        {showPlaceholder ? (
          <NoPracticeCard title="Practice" />
        ) : activity ? (
          <PracticeHeatmap data={activity.heatmap} />
        ) : null}
      </ChartSlot>
      <ChartSlot
        loading={status === undefined}
        skeleton={<ChartSkeleton title="Mastery" />}
      >
        {status ? <MasteryDonut data={status} /> : null}
      </ChartSlot>
      <ChartSlot
        loading={activity === undefined}
        skeleton={<ChartSkeleton title="Accuracy trend" />}
      >
        {showPlaceholder ? (
          <NoPracticeCard title="Accuracy trend" />
        ) : activity ? (
          <AccuracyTrend data={activity.trend} />
        ) : null}
      </ChartSlot>
      <ChartSlot
        loading={forecast === undefined}
        skeleton={<ChartSkeleton title="Upcoming" />}
      >
        {forecast ? <ReviewForecast data={forecast} /> : null}
      </ChartSlot>
    </div>
  );
}

function NoPracticeCard({ title }: { title: string }) {
  return (
    <MemoryDashboardCard className={chartCardClassName}>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground">
        Shows up after your first session.
      </p>
    </MemoryDashboardCard>
  );
}
