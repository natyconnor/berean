import type { MemoryStatus } from "@/lib/memory-scheduler";
import {
  MEMORY_STATUS_ORDER,
  MEMORY_STATUS_STYLE,
} from "@/lib/memory-status-style";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { cn } from "@/lib/utils";
import { chartCardClassName } from "./chart-card";

export interface MasteryDistribution {
  new: number;
  learning: number;
  reviewing: number;
  mastered: number;
  total: number;
}

/** Horizontal stacked bar of verses by lifecycle status. */
export function MasteryBar({ data }: { data: MasteryDistribution }) {
  const total = data.total;
  const visible = MEMORY_STATUS_ORDER.filter((key) => data[key] > 0);

  const summary =
    total === 0
      ? "No verses yet."
      : visible
          .map(
            (key) =>
              `${data[key]} ${MEMORY_STATUS_STYLE[key].label.toLowerCase()}`,
          )
          .join(", ");

  return (
    <MemoryDashboardCard className={chartCardClassName}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Mastery</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} {total === 1 ? "verse" : "verses"}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 flex-1 text-sm text-muted-foreground">
          No verses yet. Heart a verse to start memorizing.
        </p>
      ) : (
        <div className="mt-3 flex flex-1 flex-col justify-center gap-3">
          <div
            role="img"
            aria-label={`Mastery distribution: ${summary}.`}
            className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full"
          >
            {visible.map((key) => (
              <div
                key={key}
                className={cn(
                  "h-full first:rounded-l-full last:rounded-r-full",
                  MEMORY_STATUS_STYLE[key].bar,
                )}
                style={{ width: `${(data[key] / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {MEMORY_STATUS_ORDER.map((key) => (
              <StatusLegendItem key={key} status={key} count={data[key]} />
            ))}
          </ul>
        </div>
      )}
    </MemoryDashboardCard>
  );
}

function StatusLegendItem({
  status,
  count,
}: {
  status: MemoryStatus;
  count: number;
}) {
  const style = MEMORY_STATUS_STYLE[status];
  const muted = count === 0;
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 text-xs",
        muted ? "text-muted-foreground/60" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-2.5 w-2.5 shrink-0 rounded-sm",
          style.dot,
          muted && "opacity-40",
        )}
      />
      <span
        className={cn(
          "font-semibold tabular-nums",
          muted ? "text-muted-foreground/70" : "text-foreground",
        )}
      >
        {count}
      </span>
      {style.label}
    </li>
  );
}
