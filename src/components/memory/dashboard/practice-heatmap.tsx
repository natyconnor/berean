import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import {
  heatmapGridWidthPx,
  padHeatmapFutureDays,
  toWeeks,
  visibleWeeksFromEnd,
  weeksThatFit,
  type DayCount,
} from "@/lib/practice-heatmap";
import { chartCardClassName } from "./chart-card";
import { chartColor } from "./svg-chart-helpers";

export type { DayCount };

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

/** Learn, review, deck, and free practice all count as practice activity. */
function practicePhrase(count: number): string {
  return count === 1 ? "1 practice" : `${count} practices`;
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
 * GitHub-style practice heatmap: one fixed-size cell per day. Columns are
 * Sunday-aligned weeks; extra width reveals more history instead of stretching
 * cells. The series is padded through the rest of this week plus two future
 * weeks so upcoming empty days stay visible.
 */
export function PracticeHeatmap({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  const weeks = toWeeks(padHeatmapFutureDays(data));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [fitCount, setFitCount] = useState(weeks.length);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const fitted = weeksThatFit(el.clientWidth);
      if (fitted > 0) setFitCount(fitted);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [weeks.length]);

  const visibleWeeks = visibleWeeksFromEnd(weeks, fitCount);
  const gridWidthPx = heatmapGridWidthPx(visibleWeeks.length);

  // Recomputed on the visible slice so the leftmost on-screen week still gets
  // a month label after older columns are clipped.
  const monthByWeek = visibleWeeks.map((week, weekIndex) => {
    const firstReal = week.find((c): c is DayCount => c !== null);
    if (!firstReal) return "";
    const month = new Date(firstReal.dayStart).getMonth();
    if (weekIndex === 0) return monthLabel(firstReal.dayStart);
    const prev = visibleWeeks[weekIndex - 1].find(
      (c): c is DayCount => c !== null,
    );
    const prevMonth = prev ? new Date(prev.dayStart).getMonth() : -1;
    return month !== prevMonth ? monthLabel(firstReal.dayStart) : "";
  });

  const label =
    total === 0
      ? "Practice heatmap: no practice in this window."
      : `Practice heatmap: ${total} practices over the last ${data.length} days.`;

  return (
    <MemoryDashboardCard className={chartCardClassName}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Practice</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {practicePhrase(total)}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 flex-1 text-sm text-muted-foreground">
          No practice yet. Learning and reviewing verses will show up here.
        </p>
      ) : (
        <div
          role="img"
          aria-label={label}
          className="mt-3 flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 gap-1">
            {/* Weekday guides down the left, aligned to the 7 cell rows. */}
            <div className="grid shrink-0 grid-rows-7 gap-1 pt-[13px] pr-0.5">
              {WEEKDAY_LABELS.map((wd, i) => (
                <span
                  key={i}
                  className="flex h-3 items-center text-[9px] leading-none text-muted-foreground"
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Newest weeks stay on the right; extra width reveals more history. */}
            <div
              ref={scrollerRef}
              className="flex min-h-0 min-w-0 flex-1 justify-end overflow-hidden"
            >
              <div className="shrink-0" style={{ width: gridWidthPx }}>
                <div className="mb-1 flex gap-1" aria-hidden>
                  {monthByWeek.map((m, i) => (
                    <span
                      key={i}
                      className="h-[9px] w-3 shrink-0 text-[9px] leading-none text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                </div>

                <div className="flex gap-1">
                  {visibleWeeks.map((week, w) => (
                    <div
                      key={w}
                      className="grid w-3 shrink-0 grid-rows-7 gap-1"
                    >
                      {week.map((cell, r) =>
                        cell === null ? (
                          <span
                            key={`blank-${w}-${r}`}
                            className="size-3"
                            aria-hidden
                          />
                        ) : (
                          <Tooltip key={cell.dayStart}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="size-3 rounded-[3px] outline-none transition-[filter] duration-150 hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`${formatDay(cell.dayStart)}: ${practicePhrase(cell.count)}`}
                                style={cellStyle(cell.count, max)}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="tabular-nums">
                              {formatDay(cell.dayStart)}
                              <span className="mx-1.5 text-background/50">
                                ·
                              </span>
                              {practicePhrase(cell.count)}
                            </TooltipContent>
                          </Tooltip>
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex shrink-0 items-center justify-end gap-1.5 pt-2 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[0, 0.4, 0.7, 1].map((t) => (
              <span
                key={t}
                className="inline-block size-2.5 rounded-[2px]"
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
