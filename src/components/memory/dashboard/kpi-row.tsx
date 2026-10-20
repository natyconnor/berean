import type { ReactNode } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Flame,
  Layers,
  Target,
} from "lucide-react";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import type { StreakInfo } from "@/lib/dashboard-buckets";
import { practicedDaysCopy, streakCopy } from "@/lib/streak-copy";
import { cn } from "@/lib/utils";

/**
 * KPI inputs. Each numeric field may be `undefined` while its backing query is
 * still loading (the cell shows a skeleton), so the KPI row never blocks on the
 * slowest aggregate. `accuracy30d` is additionally `null` when there are no
 * reviews to average.
 */
export interface DashboardKpis {
  dueToday: number | undefined;
  streak: StreakInfo | undefined;
  /** Days with practice in the last 7, shown while the streak is hidden. */
  practicedLastWeek: number | undefined;
  inMemory: number | undefined;
  accuracy30d: number | null | undefined;
}

/** The four headline numbers above the charts. */
export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Kpi
        icon={<CalendarClock className="h-4 w-4" />}
        label="Due today"
        value={
          kpis.dueToday === undefined ? null : kpis.dueToday.toLocaleString()
        }
      />
      <PracticeKpi
        streak={kpis.streak}
        practicedLastWeek={kpis.practicedLastWeek}
      />
      <Kpi
        icon={<Layers className="h-4 w-4" />}
        label="In memory"
        value={
          kpis.inMemory === undefined ? null : kpis.inMemory.toLocaleString()
        }
      />
      <Kpi
        icon={<Target className="h-4 w-4" />}
        label="30d accuracy"
        value={
          kpis.accuracy30d === undefined
            ? null
            : kpis.accuracy30d === null
              ? "—"
              : `${Math.round(kpis.accuracy30d)}%`
        }
      />
    </div>
  );
}

/**
 * The streak once it means something (2+ days); until then, and after one
 * ends, how many of the last 7 days had practice. Never a nudge or a loss.
 */
function PracticeKpi({
  streak,
  practicedLastWeek,
}: {
  streak: StreakInfo | undefined;
  practicedLastWeek: number | undefined;
}) {
  const loading = streak === undefined || practicedLastWeek === undefined;
  const copy = streak === undefined ? null : streakCopy(streak.days);

  return (
    <MemoryDashboardCard className="p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className={cn(copy && "text-[color:var(--chart-1)]")}>
          {copy ? (
            <Flame className="h-4 w-4" />
          ) : (
            <CalendarCheck className="h-4 w-4" />
          )}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em]">
          Practice
        </span>
      </div>
      {loading ? (
        <div
          className="mt-2 h-6 w-10 animate-pulse rounded bg-muted"
          aria-hidden
        />
      ) : copy ? (
        <>
          <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
            {copy.label}
          </div>
          {copy.note ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {copy.note}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
          {practicedDaysCopy(practicedLastWeek)}
        </p>
      )}
    </MemoryDashboardCard>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: ReactNode;
  /** The formatted value, or `null` while the backing query is loading. */
  value: string | null;
  label: string;
  accent?: boolean;
}) {
  return (
    <MemoryDashboardCard className="p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className={cn(accent && "text-[color:var(--chart-1)]")}>
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      {value === null ? (
        <div
          className="mt-2 h-6 w-10 animate-pulse rounded bg-muted"
          aria-hidden
        />
      ) : (
        <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
      )}
    </MemoryDashboardCard>
  );
}
