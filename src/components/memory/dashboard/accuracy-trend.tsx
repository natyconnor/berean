import { useCallback, useState, type PointerEvent } from "react";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import {
  accuracyTooltipCopy,
  hoverIndexFromX,
  type DayAccuracy,
} from "@/lib/accuracy-trend";
import { chartCardClassName } from "./chart-card";
import {
  areaPath,
  chartColor,
  linePath,
  scaleLinear,
} from "./svg-chart-helpers";

export type { DayAccuracy };

const VIEW_W = 300;
const VIEW_H = 96; // rendered at h-24 (96px) so vertical units map 1:1 to pixels
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

const yFor = (pct: number) =>
  scaleLinear(pct, 0, 100, VIEW_H - PAD_BOTTOM, PAD_TOP);

function xForIndex(index: number, dayCount: number): number {
  return dayCount <= 1
    ? VIEW_W / 2
    : scaleLinear(index, 0, dayCount - 1, 0, VIEW_W);
}

function formatDay(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatAxisDay(dayStart: number): string {
  return new Date(dayStart).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function tooltipTranslateX(x: number): string {
  if (x < 48) return "0%";
  if (x > VIEW_W - 48) return "-100%";
  return "-50%";
}

function pointerToViewX(
  event: { clientX: number },
  svg: SVGSVGElement,
): number {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return ((event.clientX - rect.left) / rect.width) * VIEW_W;
}

/** Line/area chart of daily average accuracy over the window. */
export function AccuracyTrend({ data }: { data: DayAccuracy[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const graded = data.filter(
    (d): d is DayAccuracy & { average: number } => d.average !== null,
  );
  const overallCount = data.reduce((sum, d) => sum + d.count, 0);

  const points = graded.map((d) => {
    const originalIndex = data.indexOf(d);
    return { x: xForIndex(originalIndex, data.length), y: yFor(d.average) };
  });

  const latest = graded.length > 0 ? graded[graded.length - 1].average : null;
  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? data[hoverIndex] : undefined;
  const hoverX =
    hoverIndex !== null ? xForIndex(hoverIndex, data.length) : null;
  const hoverY =
    hovered?.average !== null && hovered?.average !== undefined
      ? yFor(hovered.average)
      : null;
  const tooltip = hovered ? accuracyTooltipCopy(hovered) : null;

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      setHoverIndex(
        hoverIndexFromX(
          pointerToViewX(event, event.currentTarget),
          data.length,
          VIEW_W,
        ),
      );
    },
    [data.length],
  );

  const label =
    graded.length === 0
      ? "Accuracy trend: no reviews in this window."
      : `Accuracy trend over ${data.length} days, most recent average ${Math.round(
          graded[graded.length - 1].average,
        )} percent.`;

  return (
    <MemoryDashboardCard className={chartCardClassName}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Accuracy trend</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {data.length}d
        </span>
      </div>

      {overallCount === 0 ? (
        <p className="mt-3 flex-1 text-sm text-muted-foreground">
          No reviews yet. Accuracy will trend here as you practice.
        </p>
      ) : (
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          {latest !== null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {Math.round(latest)}%
              </span>
              <span className="text-[11px] text-muted-foreground">latest</span>
            </div>
          )}

          {/* Left gutter holds the y-axis labels; the chart fills the rest. */}
          <div className="mt-2 flex h-24 gap-1.5">
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

            <div className="relative h-24 min-w-0 flex-1">
              <svg
                role="img"
                aria-label={label}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="none"
                className="h-24 w-full cursor-crosshair"
                onPointerMove={onPointerMove}
                onPointerLeave={() => setHoverIndex(null)}
              >
                <rect
                  x={0}
                  y={0}
                  width={VIEW_W}
                  height={VIEW_H}
                  fill="transparent"
                />
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
                {last && hoverIndex === null && (
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r={2.5}
                    fill={chartColor(1)}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {hoverX !== null && (
                  <line
                    x1={hoverX}
                    y1={PAD_TOP}
                    x2={hoverX}
                    y2={VIEW_H - PAD_BOTTOM}
                    stroke={chartColor(1)}
                    strokeWidth={1}
                    strokeOpacity={0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {hoverX !== null && hoverY !== null && (
                  <circle
                    cx={hoverX}
                    cy={hoverY}
                    r={3.5}
                    fill={chartColor(1)}
                    stroke="var(--card)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {hovered && tooltip && hoverX !== null && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute z-20 w-max rounded-md bg-foreground px-3 py-1.5 text-xs text-background tabular-nums"
                  style={{
                    left: `${(hoverX / VIEW_W) * 100}%`,
                    top:
                      hoverY !== null ? `${(hoverY / VIEW_H) * 100}%` : "12px",
                    marginTop: hoverY !== null ? "-10px" : 0,
                    transform: `translateX(${tooltipTranslateX(hoverX)}) translateY(-100%)`,
                  }}
                >
                  <div>{formatDay(hovered.dayStart)}</div>
                  <div className="font-medium">{tooltip.headline}</div>
                  {hovered.average !== null && hovered.count > 0 ? (
                    <div className="text-background/70">{tooltip.detail}</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {data.length > 1 && (
            <div className="mt-1.5 flex justify-between pl-[34px] text-[10px] text-muted-foreground">
              <span>{formatAxisDay(data[0].dayStart)}</span>
              <span>{formatAxisDay(data[data.length - 1].dayStart)}</span>
            </div>
          )}
        </div>
      )}
    </MemoryDashboardCard>
  );
}
