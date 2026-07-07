import {
  areaPath,
  chartColor,
  linePath,
  scaleLinear,
} from "./svg-chart-helpers";

export interface DayAccuracy {
  dayStart: number;
  average: number | null;
  count: number;
}

const VIEW_W = 300;
const VIEW_H = 96;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

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

  const label =
    graded.length === 0
      ? "Accuracy trend: no reviews in this window."
      : `Accuracy trend over ${data.length} days, most recent average ${Math.round(
          graded[graded.length - 1].average,
        )} percent.`;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
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
        <svg
          role="img"
          aria-label={label}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="mt-3 h-24 w-full"
        >
          {[0, 50, 100].map((pct) => {
            const y = scaleLinear(pct, 0, 100, VIEW_H - PAD_BOTTOM, PAD_TOP);
            return (
              <line
                key={pct}
                x1={0}
                y1={y}
                x2={VIEW_W}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
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
        </svg>
      )}
    </section>
  );
}
