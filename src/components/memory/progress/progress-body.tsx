import { useId } from "react";
import { BarChart3 } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { KpiRow } from "@/components/memory/dashboard/kpi-row";
import { InternalLink } from "@/components/memory/internal-link";
import { GoalKindIcon } from "@/components/memory/today/goal-kind-icon";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { useTodayModel, type TodayGoal } from "@/hooks/use-today-model";
import { MASTERED_INTERVAL_DAYS } from "@/lib/memory-scheduler";
import { goalKey } from "@/lib/memory-verses-drawer";
import { goalProgressRow } from "@/lib/progress-goal-rows";
import { cn } from "@/lib/utils";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

import { ProgressCharts } from "./progress-charts";
import { progressKpis, useProgressActivity } from "./use-progress-activity";

/**
 * Your progress: the KPI row, the four charts (2×2, one column on mobile),
 * and learning and mastery by goal. Each part loads on its own.
 */
export function ProgressBody() {
  const now = useLiveNow();
  const status = useQuery(api.verseMemory.memoryStatus, {});
  const stats = useQuery(api.verseMemory.memoryStats, {
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
  });
  const { activity, forecast } = useProgressActivity(now);
  const today = useTodayModel(now);

  if (
    today !== undefined &&
    today.goals.length === 0 &&
    today.totalInMemory === 0
  ) {
    return <ProgressEmpty />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <KpiRow kpis={progressKpis({ activity, status, stats })} />
        <ProgressCharts
          activity={activity}
          forecast={forecast}
          status={status}
          className="sm:grid-cols-2"
          placeholderWithoutPractice
        />
      </div>
      {today && today.goals.length > 0 ? (
        <GoalProgressTable goals={today.goals} now={now} />
      ) : null}
    </div>
  );
}

function ProgressEmpty() {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <BarChart3
        aria-hidden
        className="mx-auto mb-3 h-6 w-6 text-muted-foreground/70"
      />
      <p className="text-sm text-muted-foreground">
        Your progress will show up here after your first session.
      </p>
      <Button asChild size="sm" className="mt-4 max-sm:h-11">
        <InternalLink href="/memory">Go to Today</InternalLink>
      </Button>
    </div>
  );
}

function GoalProgressTable({
  goals,
  now,
}: {
  goals: readonly TodayGoal[];
  now: number;
}) {
  const headingId = useId();
  const timeZone = getViewerTimeZone();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className="text-sm font-semibold tracking-tight">
          Learning and mastery by goal
        </h3>
        <span className="text-xs text-muted-foreground">
          Mastered means {MASTERED_INTERVAL_DAYS}+ days between reviews
        </span>
      </div>
      <div className="rounded-xl border bg-card">
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b px-4 py-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase sm:grid"
        >
          <span>Goal</span>
          <span>Learned</span>
          <span>Mastery</span>
          <span className="text-right">Next</span>
        </div>
        <ul className="divide-y">
          {goals.map((goal) => {
            const row = goalProgressRow(goal, now, timeZone);
            return (
              <li
                key={goalKey(goal)}
                className="grid gap-2.5 px-4 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-semibold">{goal.title}</span>
                    <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span aria-hidden>·</span>
                      <GoalKindIcon kind={goal.kind} className="size-3" />
                      {row.kindLabel}
                    </span>
                  </p>
                  {row.nextLabel ? (
                    <NextChip
                      label={row.nextLabel}
                      today={row.nextIsToday}
                      className="sm:hidden"
                    />
                  ) : null}
                </div>
                <Track
                  label={row.learnedLabel}
                  fraction={row.learnedFraction}
                  barClassName="bg-primary"
                />
                <Track
                  label={row.masteryLabel}
                  fraction={row.masteryFraction}
                  barClassName="bg-emerald-500"
                />
                <div className="hidden text-right sm:block">
                  {row.nextLabel ? (
                    <NextChip label={row.nextLabel} today={row.nextIsToday} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Track({
  label,
  fraction,
  barClassName,
}: {
  label: string;
  fraction: number;
  barClassName: string;
}) {
  const width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        aria-hidden
        className="h-1.5 max-w-60 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", barClassName)}
          style={{ width }}
        />
      </div>
    </div>
  );
}

function NextChip({
  label,
  today,
  className,
}: {
  label: string;
  today: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        today
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
