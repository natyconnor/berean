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

/**
 * Upcoming review load: verses due per day over the next `data.length` days,
 * as a labeled bar chart. Day 0 (Today) folds in any overdue verses and is
 * emphasized; future days fade back. Every bar carries its count inline and a
 * full date in its tooltip, with sparse date ticks along the axis.
 */
export function ReviewForecast({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  const count = data.length;

  // Sparse axis ticks: first (Today), roughly-thirds, and last.
  const tickIndices = new Set<number>([
    0,
    Math.round((count - 1) / 3),
    Math.round((2 * (count - 1)) / 3),
    count - 1,
  ]);

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
            className="mt-2 flex h-24 items-end gap-1"
          >
            {data.map((d, i) => {
              const isToday = i === 0;
              const heightPct =
                d.count <= 0 ? 0 : Math.max(6, (d.count / max) * 100);
              return (
                <div
                  key={d.dayStart}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  title={`${formatDay(d.dayStart)}: ${d.count} due`}
                >
                  <span className="text-[9px] leading-none text-muted-foreground tabular-nums">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  {d.count > 0 ? (
                    <div
                      className="w-full rounded-t-[3px]"
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
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-1 text-[10px] text-muted-foreground">
            {data.map((d, i) => (
              <span
                key={d.dayStart}
                className="flex-1 truncate text-center first:text-left last:text-right"
              >
                {tickIndices.has(i) ? tickLabel(d.dayStart, i) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
