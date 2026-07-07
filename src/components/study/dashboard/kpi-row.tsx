import type { ReactNode } from "react";
import { CalendarClock, Flame, Layers, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI inputs. Each numeric field may be `undefined` while its backing query is
 * still loading (the cell shows a skeleton), so the KPI row never blocks on the
 * slowest aggregate. `accuracy30d` is additionally `null` when there are no
 * reviews to average.
 */
export interface DashboardKpis {
  dueToday: number | undefined;
  streakDays: number | undefined;
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
      <Kpi
        icon={<Flame className="h-4 w-4" />}
        label="Day streak"
        value={
          kpis.streakDays === undefined
            ? null
            : kpis.streakDays.toLocaleString()
        }
        accent={kpis.streakDays !== undefined && kpis.streakDays > 0}
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
    <div className="rounded-xl border bg-card p-3 shadow-sm">
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
    </div>
  );
}
