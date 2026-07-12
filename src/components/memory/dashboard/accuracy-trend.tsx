import {
  areaPath,
  chartColor,
  linePath,
  scaleLinear,
} from "./svg-chart-helpers";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";

export interface DayAccuracy {
  dayStart: number;
  average: number | null;
  count: number;
}

const VIEW_W = 300;
const VIEW_H = 96; // rendered at h-24 (96px) so vertical units map 1:1 to pixels
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

const yFor = (pct: number) =>
  scaleLinear(pct, 0, 100, VIEW_H - PAD_BOTTOM, PAD_TOP);

function formatDay(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Line/area chart of daily average accuracy over the window. */
export function AccuracyTrend({ data }: { data: DayAccuracy[] }) {
  const graded = data.filter(
    (d): d is DayAccuracy & { average: number } => d.average !== null,
  );
  const overallCount = data.reduce((sum, d) => sum + d.count, 0);

  const points = graded.map((d) => {
    const originalIndex = data.indexOf(d);
    const x =
      data.length <= 1
        ? VIEW_W / 2
        : scaleLinear(originalIndex, 0, data.length - 1, 0, VIEW_W);
    const y = scaleLinear(d.average, 0, 100, VIEW_H - PAD_BOTTOM, PAD_TOP);
    return { x, y };
  });

  const latest = graded.length > 0 ? graded[graded.length - 1].average : null;
  const last = points[points.length - 1];

  const label =
    graded.length === 0
      ? "Accuracy trend: no reviews in this window."
      : `Accuracy trend over ${data.length} days, most recent average ${Math.round(
          graded[graded.length - 1].average,
        )} percent.`;

  return (
    <MemoryDashboardCard className="p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Accuracy trend</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {data.length}d
        </span>
      </div>

      {overallCount === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reviews yet. Accuracy will trend here as you practice.
        </p>
      ) : (
        <>
          {latest !== null && (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {Math.round(latest)}%
              </span>
              <span className="text-[11px] text-muted-foreground">latest</span>
            </div>
          )}

          {/* Left gutter holds the y-axis labels; the chart fills the rest. */}
          <div className="mt-2 flex gap-1.5">
            <div className="relative w-7 shrink-0" aria-hidden>
              {[100, 50, 0].map((pct) => (
                <span
                  key={pct}
                  className="absolute right-0 -translate-y-1/2 text-[9px] leading-none text-muted-foreground tabular-nums"
                  style={{ top: yFor(pct) }}
                >
                  {pct}%
                </span>
              ))}
            </div>

            <svg
              role="img"
              aria-label={label}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="h-24 w-full"
            >
              {[0, 50, 100].map((pct) => {
                const y = yFor(pct);
                return (
                  <line
                    key={pct}
                    x1={0}
                    y1={y}
                    x2={VIEW_W}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray={pct === 50 ? "3 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {points.length >= 2 && (
                <path
                  d={areaPath(points, VIEW_H - PAD_BOTTOM)}
                  fill={chartColor(1)}
                  opacity={0.15}
                />
              )}
              {points.length === 1 ? (
                // A single graded day: a flat reference line at its accuracy.
                <line
                  x1={0}
                  y1={points[0].y}
                  x2={VIEW_W}
                  y2={points[0].y}
                  stroke={chartColor(1)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <path
                  d={linePath(points)}
                  fill="none"
                  stroke={chartColor(1)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {last && (
                <circle
                  cx={last.x}
                  cy={last.y}
                  r={2.5}
                  fill={chartColor(1)}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>

          {data.length > 1 && (
            <div className="mt-1.5 flex justify-between pl-[34px] text-[10px] text-muted-foreground">
              <span>{formatDay(data[0].dayStart)}</span>
              <span>{formatDay(data[data.length - 1].dayStart)}</span>
            </div>
          )}
        </>
      )}
    </MemoryDashboardCard>
  );
}
