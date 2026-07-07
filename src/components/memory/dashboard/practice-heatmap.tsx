import type { CSSProperties } from "react";
import { chartColor } from "./svg-chart-helpers";

export interface DayCount {
  dayStart: number;
  count: number;
}

function formatDay(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

/** Map a count to a background: muted at 0, ramping chart-1 opacity otherwise. */
function cellStyle(count: number, max: number): CSSProperties {
  if (count <= 0) {
    return { backgroundColor: "var(--muted)" };
  }
  const intensity = max <= 0 ? 1 : 0.25 + 0.75 * (count / max);
  return {
    backgroundColor: `color-mix(in oklab, ${chartColor(1)} ${Math.round(
      intensity * 100,
    )}%, transparent)`,
  };
}

/**
 * GitHub-style practice heatmap: one cell per day over the window, columns are
 * weeks (Sunday-aligned) and rows are weekdays.
 */
export function PracticeHeatmap({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);

  // Lead the first column with blank cells so the grid aligns to weekday rows.
  const leadingBlanks =
    data.length > 0 ? new Date(data[0].dayStart).getUTCDay() : 0;
  const cells: (DayCount | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...data,
  ];

  const label =
    total === 0
      ? "Practice heatmap: no reviews in this window."
      : `Practice heatmap: ${total} reviews over the last ${data.length} days.`;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Practice</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} {total === 1 ? "review" : "reviews"}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reviews yet. Your daily practice will show up here.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={label}
            className="mt-3 grid grid-flow-col grid-rows-7 gap-1"
          >
            {cells.map((cell, i) =>
              cell === null ? (
                <span
                  key={`blank-${i}`}
                  className="aspect-square"
                  aria-hidden
                />
              ) : (
                <span
                  key={cell.dayStart}
                  className="aspect-square rounded-[3px]"
                  title={`${formatDay(cell.dayStart)}: ${cell.count} ${
                    cell.count === 1 ? "review" : "reviews"
                  }`}
                  style={cellStyle(cell.count, max)}
                />
              ),
            )}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[0, 0.4, 0.7, 1].map((t) => (
              <span
                key={t}
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                aria-hidden
                style={cellStyle(t === 0 ? 0 : Math.ceil(t * max), max)}
              />
            ))}
            <span>More</span>
          </div>
        </>
      )}
    </section>
  );
}
