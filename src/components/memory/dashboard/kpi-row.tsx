import type { ReactNode } from "react";
import { CalendarClock, Flame, Layers, Target } from "lucide-react";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import type { StreakInfo } from "@/lib/dashboard-buckets";
import { cn } from "@/lib/utils";

/**
 * KPI inputs. Each numeric field may be `undefined` while its backing query is
 * still loading (the cell shows a skeleton), so the KPI row never blocks on the
 * slowest aggregate. `accuracy30d` is additionally `null` when there are no
 * reviews to average. `streak` carries `atRisk` so a live streak waiting on
 * today's practice can nudge instead of reading as zero.
 */
export interface DashboardKpis {
  dueToday: number | undefined;
  streak: StreakInfo | undefined;
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
      <StreakKpi streak={kpis.streak} />
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

function StreakKpi({ streak }: { streak: StreakInfo | undefined }) {
  const loading = streak === undefined;
  const alive = streak !== undefined && streak.days > 0;
  const atRisk = streak?.atRisk === true;

  return (
    <MemoryDashboardCard
      className={cn(
        "p-3",
        atRisk &&
          "border-[color:var(--chart-1)]/45 bg-[color:var(--chart-1)]/[0.07] shadow-[0_0_0_1px_color-mix(in_oklch,var(--chart-1)_18%,transparent)]",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className={cn(
            alive && "text-[color:var(--chart-1)]",
            atRisk && "animate-pulse",
          )}
        >
          <Flame className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em]">
          Day streak
        </span>
      </div>
      {loading ? (
        <div
          className="mt-2 h-6 w-10 animate-pulse rounded bg-muted"
          aria-hidden
        />
      ) : (
        <>
          <div
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
              atRisk && "text-[color:var(--chart-1)]",
            )}
          >
            {streak.days.toLocaleString()}
          </div>
          {atRisk ? (
            <p className="mt-1 text-[11px] leading-snug font-medium text-[color:var(--chart-1)]">
              Keep it going — review or learn a verse today
            </p>
          ) : alive ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {streak.days === 1 ? "Day one — nice start" : "On a roll"}
            </p>
          ) : null}
        </>
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
