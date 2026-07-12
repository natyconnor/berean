import type { CSSProperties } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { chartColor } from "./svg-chart-helpers";

export interface DayCount {
  dayStart: number;
  count: number;
}

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]; // rows Sun..Sat

function formatDay(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function monthLabel(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    month: "short",
  });
}

function reviewPhrase(count: number): string {
  return count === 1 ? "1 review" : `${count} reviews`;
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
 * Group days into Sunday-aligned week columns. The first column is padded with
 * leading `null`s so weekday rows line up (row 0 = Sunday).
 *
 * `dayStart` values are local midnights (as UTC instants), so {@link Date#getDay}
 * matches the viewer's weekday.
 */
function toWeeks(data: DayCount[]): (DayCount | null)[][] {
  if (data.length === 0) return [];
  const leadingBlanks = new Date(data[0].dayStart).getDay();
  const cells: (DayCount | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...data,
  ];
  const weeks: (DayCount | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/**
 * GitHub-style practice heatmap: one cell per day over the window, columns are
 * weeks (Sunday-aligned) and rows are weekdays. Month labels sit above the
 * column where each new month begins, with weekday guides down the left.
 */
export function PracticeHeatmap({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  const weeks = toWeeks(data);

  // A month label shows above the first week whose first real day belongs to a
  // month we haven't labeled yet.
  const monthByWeek = weeks.map((week, weekIndex) => {
    const firstReal = week.find((c): c is DayCount => c !== null);
    if (!firstReal) return "";
    const month = new Date(firstReal.dayStart).getMonth();
    if (weekIndex === 0) return monthLabel(firstReal.dayStart);
    const prev = weeks[weekIndex - 1].find((c): c is DayCount => c !== null);
    const prevMonth = prev ? new Date(prev.dayStart).getMonth() : -1;
    return month !== prevMonth ? monthLabel(firstReal.dayStart) : "";
  });

  const label =
    total === 0
      ? "Practice heatmap: no reviews in this window."
      : `Practice heatmap: ${total} reviews over the last ${data.length} days.`;

  return (
    <MemoryDashboardCard className="p-4">
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
        <div role="img" aria-label={label} className="mt-3">
          <div className="flex gap-1">
            {/* Weekday guides down the left, aligned to the 7 cell rows. */}
            <div className="grid shrink-0 grid-rows-7 gap-1 pr-0.5 pt-[15px]">
              {WEEKDAY_LABELS.map((wd, i) => (
                <span
                  key={i}
                  className="flex h-full items-center text-[9px] leading-none text-muted-foreground"
                >
                  {wd}
                </span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              {/* Month labels, one grid cell per week column. */}
              <div
                className="mb-1 grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                }}
                aria-hidden
              >
                {monthByWeek.map((m, i) => (
                  <span
                    key={i}
                    className="text-[9px] leading-none text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>

              {/* The cell grid: one column per week, seven weekday rows. */}
              <div
                className="grid grid-flow-col grid-rows-7 gap-1"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                }}
              >
                {weeks.flatMap((week, w) =>
                  week.map((cell, r) =>
                    cell === null ? (
                      <span
                        key={`blank-${w}-${r}`}
                        className="aspect-square"
                        aria-hidden
                      />
                    ) : (
                      <Tooltip key={cell.dayStart}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="aspect-square rounded-[3px] outline-none transition-[filter] duration-150 hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`${formatDay(cell.dayStart)}: ${reviewPhrase(cell.count)}`}
                            style={cellStyle(cell.count, max)}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="tabular-nums">
                          {formatDay(cell.dayStart)}
                          <span className="mx-1.5 text-background/50">·</span>
                          {reviewPhrase(cell.count)}
                        </TooltipContent>
                      </Tooltip>
                    ),
                  ),
                )}
              </div>
            </div>
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
        </div>
      )}
    </MemoryDashboardCard>
  );
}
