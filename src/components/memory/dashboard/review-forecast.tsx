import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chartColor } from "./svg-chart-helpers";

export interface DayCount {
  dayStart: number;
  count: number;
}

function formatDay(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function tickLabel(dayStart: number, index: number): string {
  if (index === 0) return "Today";
  return new Date(dayStart).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function duePhrase(count: number): string {
  return count === 1 ? "1 due" : `${count} due`;
}

/**
 * Upcoming review load: verses due per day over the next `data.length` days,
 * as a labeled bar chart. Day 0 (Today) folds in any overdue verses and is
 * emphasized; future days fade back. Hover (or focus) any day for the full
 * date and count; sparse axis ticks stay readable at compact widths.
 */
export function ReviewForecast({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  const count = data.length;

  // Sparse axis ticks: first (Today), roughly-thirds, and last.
  const tickIndices = [
    ...new Set([
      0,
      Math.round((count - 1) / 3),
      Math.round((2 * (count - 1)) / 3),
      count - 1,
    ]),
  ].sort((a, b) => a - b);

  const label =
    total === 0
      ? "Review forecast: nothing scheduled in this window."
      : `Review forecast: ${total} reviews due over the next ${count} days.`;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Upcoming</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          next {count}d
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing scheduled. New reviews appear here as verses come due.
        </p>
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {total}
            </span>
            <span className="text-[11px] text-muted-foreground">
              due in the next {count} days
            </span>
          </div>

          <div
            role="img"
            aria-label={label}
            className="mt-2 flex h-24 items-end gap-0.5"
          >
            {data.map((d, i) => {
              const isToday = i === 0;
              const heightPct =
                d.count <= 0 ? 0 : Math.max(6, (d.count / max) * 100);
              return (
                <Tooltip key={d.dayStart}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-sm px-px outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${formatDay(d.dayStart)}: ${duePhrase(d.count)}`}
                    >
                      <span className="text-[9px] leading-none text-muted-foreground tabular-nums">
                        {d.count > 0 ? d.count : "\u00a0"}
                      </span>
                      {d.count > 0 ? (
                        <div
                          className="w-full rounded-t-[3px] transition-opacity group-hover:opacity-90"
                          style={{
                            height: `${heightPct}%`,
                            backgroundColor: isToday
                              ? chartColor(1)
                              : `color-mix(in oklab, ${chartColor(1)} 45%, transparent)`,
                          }}
                        />
                      ) : (
                        // Keep empty days visible with a faint baseline tick.
                        <div className="h-px w-full rounded bg-border" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="tabular-nums">
                    {formatDay(d.dayStart)}
                    <span className="mx-1.5 text-background/50">·</span>
                    {duePhrase(d.count)}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Positioned ticks (not one truncated slot per day) so labels stay readable. */}
          <div
            className="relative mt-1.5 h-3.5 text-[10px] text-muted-foreground"
            aria-hidden
          >
            {tickIndices.map((i) => {
              const day = data[i];
              if (!day) return null;
              const leftPct = count <= 1 ? 0 : (i / (count - 1)) * 100;
              const align =
                i === 0 ? "start" : i === count - 1 ? "end" : "center";
              return (
                <span
                  key={day.dayStart}
                  className="absolute top-0 whitespace-nowrap"
                  style={{
                    left: `${leftPct}%`,
                    transform:
                      align === "start"
                        ? "none"
                        : align === "end"
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {tickLabel(day.dayStart, i)}
                </span>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
