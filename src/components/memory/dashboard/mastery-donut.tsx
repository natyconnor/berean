import { useState } from "react";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import {
  MEMORY_STATUS_STYLE,
  STARTED_MEMORY_STATUS_ORDER,
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

/** Status with the most started verses; ties keep the earlier lifecycle step. */
export function largestStartedStatus(
  data: MasteryDistribution,
): (typeof STARTED_MEMORY_STATUS_ORDER)[number] {
  return STARTED_MEMORY_STATUS_ORDER.reduce((best, key) =>
    data[key] > data[best] ? key : best,
  );
}

function startedSharePercent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

// The ring is drawn with `pathLength={100}`, so every dash length below is a
// percentage of the circle and no circumference math is needed.
const RING_LENGTH = 100;
const RING_RADIUS = 15.5;
const RING_WIDTH = 5;
const VIEW_SIZE = 42;
/** Hairline break between neighboring arcs, matching the legend's dot spacing. */
const SEGMENT_GAP = 1.2;

/**
 * Share of started verses per lifecycle status as a donut. The hole shows the
 * hovered status's share, or the largest share when nothing is hovered.
 * Hearted-but-unstarted (`new`) verses are a backlog, not a mastery bucket, so
 * they are excluded here and surface in the Library's "Not started" view
 * instead.
 */
export function MasteryDonut({ data }: { data: MasteryDistribution }) {
  const [hovered, setHovered] = useState<
    (typeof STARTED_MEMORY_STATUS_ORDER)[number] | null
  >(null);
  const total = STARTED_MEMORY_STATUS_ORDER.reduce(
    (sum, key) => sum + data[key],
    0,
  );
  const visible = STARTED_MEMORY_STATUS_ORDER.filter((key) => data[key] > 0);
  const focused = hovered ?? largestStartedStatus(data);
  const focusedPercent = startedSharePercent(data[focused], total);

  const summary =
    total === 0
      ? "No verses started."
      : visible
          .map(
            (key) =>
              `${data[key]} ${MEMORY_STATUS_STYLE[key].label.toLowerCase()}`,
          )
          .join(", ");

  // Arcs are laid end to end from 12 o'clock; each one starts where the
  // previous ended, so offsets accumulate over the untrimmed share.
  const shares = visible.map((key) => ({
    key,
    share: (data[key] / total) * RING_LENGTH,
  }));
  const arcs = shares.map((item, i) => ({
    key: item.key,
    offset: shares.slice(0, i).reduce((sum, prev) => sum + prev.share, 0),
    // A lone full-circle arc needs no break in it.
    dash:
      visible.length === 1
        ? item.share
        : Math.max(item.share - SEGMENT_GAP, 0.5),
  }));

  return (
    <MemoryDashboardCard className={chartCardClassName}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Mastery</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} started
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 flex-1 text-sm text-muted-foreground">
          No verses started. Start learning a hearted verse to see mastery.
        </p>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 items-center justify-center gap-5">
          <div className="relative size-28 shrink-0">
            <svg
              role="img"
              aria-label={`Mastery distribution: ${summary}.`}
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className="size-full -rotate-90"
            >
              <circle
                cx={VIEW_SIZE / 2}
                cy={VIEW_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_WIDTH}
                className="stroke-muted"
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  data-status={arc.key}
                  cx={VIEW_SIZE / 2}
                  cy={VIEW_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth={RING_WIDTH}
                  pathLength={RING_LENGTH}
                  strokeDasharray={`${arc.dash} ${RING_LENGTH - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                  pointerEvents="stroke"
                  className={cn(
                    MEMORY_STATUS_STYLE[arc.key].stroke,
                    "cursor-pointer",
                  )}
                  onPointerEnter={() => setHovered(arc.key)}
                  onPointerLeave={() => setHovered(null)}
                />
              ))}
            </svg>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden
            >
              <span className="text-2xl leading-none font-semibold tabular-nums tracking-tight">
                {focusedPercent}%
              </span>
              <span className="mt-1 text-[11px] text-muted-foreground">
                {MEMORY_STATUS_STYLE[focused].label.toLowerCase()}
              </span>
            </div>
          </div>

          <ul className="flex shrink-0 flex-col gap-2.5">
            {STARTED_MEMORY_STATUS_ORDER.map((key) => (
              <StatusLegendItem
                key={key}
                status={key}
                count={data[key]}
                onPointerEnter={() => setHovered(key)}
                onPointerLeave={() => setHovered(null)}
              />
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
  onPointerEnter,
  onPointerLeave,
}: {
  status: MemoryStatus;
  count: number;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const style = MEMORY_STATUS_STYLE[status];
  const muted = count === 0;
  return (
    <li
      data-status={status}
      className={cn(
        "flex cursor-pointer items-center gap-2 text-xs",
        muted ? "text-muted-foreground/60" : "text-muted-foreground",
      )}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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
          // Right-aligned in a floor-width column so single-digit counts line
          // up, without clipping a three-digit library.
          "min-w-5 text-right font-semibold tabular-nums",
          muted ? "text-muted-foreground/70" : "text-foreground",
        )}
      >
        {count}
      </span>
      {style.label}
    </li>
  );
}
