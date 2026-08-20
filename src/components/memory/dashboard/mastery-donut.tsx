import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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

type StartedStatus = (typeof STARTED_MEMORY_STATUS_ORDER)[number];

/** Status with the most started verses; ties keep the earlier lifecycle step. */
function largestStartedStatus(data: MasteryDistribution): StartedStatus {
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
const ACTIVE_RING_WIDTH = 6.2;
const VIEW_SIZE = 42;
const RING_CX = VIEW_SIZE / 2;
const RING_CY = VIEW_SIZE / 2;
/** How far an active slice steps away from the hole, in viewBox units. */
const SLICE_EXPLODE = 1.7;
/** Hairline break between neighboring arcs, matching the legend's dot spacing. */
const SEGMENT_GAP = 1.2;

const SLICE_SPRING = {
  type: "spring" as const,
  stiffness: 480,
  damping: 32,
};

/**
 * Shift a dashed-circle slice along its midpoint so it reads as popped out.
 * A full-ring slice is left centered — sliding the whole donut looks like a
 * layout jump rather than an emphasis.
 */
function sliceShift(offset: number, share: number): { x: number; y: number } {
  if (share >= RING_LENGTH - 0.01) return { x: 0, y: 0 };
  // Dash path starts at 3 o'clock and runs clockwise in SVG space; the parent
  // svg is rotated -90deg so offset 0 is 12 o'clock on screen.
  const theta = ((offset + share / 2) / RING_LENGTH) * 2 * Math.PI;
  return {
    x: Math.cos(theta) * SLICE_EXPLODE,
    y: Math.sin(theta) * SLICE_EXPLODE,
  };
}

/**
 * Share of started verses per lifecycle status as a donut. The hole shows the
 * selected status's share: largest on first paint, then whatever was last
 * hovered. Hearted-but-unstarted (`new`) verses are a backlog, not a mastery
 * bucket, so they are excluded here and surface in the Library's "Not started"
 * view instead.
 */
export function MasteryDonut({ data }: { data: MasteryDistribution }) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<StartedStatus | null>(null);
  const total = STARTED_MEMORY_STATUS_ORDER.reduce(
    (sum, key) => sum + data[key],
    0,
  );
  const visible = STARTED_MEMORY_STATUS_ORDER.filter((key) => data[key] > 0);
  const focused = selected ?? largestStartedStatus(data);
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
    share: item.share,
    offset: shares.slice(0, i).reduce((sum, prev) => sum + prev.share, 0),
    // A lone full-circle arc needs no break in it.
    dash:
      visible.length === 1
        ? item.share
        : Math.max(item.share - SEGMENT_GAP, 0.5),
  }));
  // Paint the focused slice last so the exploded stroke sits above neighbors.
  const painted = [...arcs].sort((a, b) => {
    if (a.key === focused) return 1;
    if (b.key === focused) return -1;
    return 0;
  });

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
          <div className="relative size-28 shrink-0 overflow-visible">
            <svg
              role="img"
              aria-label={`Mastery distribution: ${summary}.`}
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className="size-full overflow-visible -rotate-90"
            >
              <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_WIDTH}
                className="stroke-muted"
              />
              {painted.map((arc) => {
                const isActive = arc.key === focused;
                const shift =
                  isActive && !reduceMotion
                    ? sliceShift(arc.offset, arc.share)
                    : { x: 0, y: 0 };
                return (
                  <motion.circle
                    key={arc.key}
                    data-status={arc.key}
                    data-active={isActive ? "true" : undefined}
                    cx={RING_CX + shift.x}
                    cy={RING_CY + shift.y}
                    r={isActive ? RING_RADIUS + 0.55 : RING_RADIUS}
                    fill="none"
                    strokeWidth={isActive ? ACTIVE_RING_WIDTH : RING_WIDTH}
                    pathLength={RING_LENGTH}
                    strokeDasharray={`${arc.dash} ${RING_LENGTH - arc.dash}`}
                    strokeDashoffset={-arc.offset}
                    pointerEvents="stroke"
                    initial={false}
                    animate={{
                      cx: RING_CX + shift.x,
                      cy: RING_CY + shift.y,
                      r: isActive ? RING_RADIUS + 0.55 : RING_RADIUS,
                      opacity: isActive ? 1 : 0.42,
                    }}
                    transition={reduceMotion ? { duration: 0 } : SLICE_SPRING}
                    className={cn(
                      MEMORY_STATUS_STYLE[arc.key].stroke,
                      "cursor-pointer",
                    )}
                    onPointerEnter={() => setSelected(arc.key)}
                  />
                );
              })}
            </svg>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden
            >
              <span className="text-2xl leading-none font-semibold tabular-nums tracking-tight">
                {focusedPercent}%
              </span>
              <span
                className={cn(
                  "mt-1 text-[11px]",
                  MEMORY_STATUS_STYLE[focused].text,
                )}
              >
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
                active={key === focused}
                onPointerEnter={() => setSelected(key)}
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
  active,
  onPointerEnter,
}: {
  status: MemoryStatus;
  count: number;
  active: boolean;
  onPointerEnter: () => void;
}) {
  const style = MEMORY_STATUS_STYLE[status];
  const muted = count === 0 && !active;
  return (
    <li
      data-status={status}
      data-active={active ? "true" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md text-xs transition-colors",
        active
          ? cn("font-medium", style.text)
          : muted
            ? "text-muted-foreground/60"
            : "text-muted-foreground",
      )}
      onPointerEnter={onPointerEnter}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-2.5 w-2.5 shrink-0 rounded-sm transition-transform",
          style.dot,
          muted && "opacity-40",
          active && "scale-125",
        )}
      />
      <span
        className={cn(
          // Right-aligned in a floor-width column so single-digit counts line
          // up, without clipping a three-digit library.
          "min-w-5 text-right font-semibold tabular-nums",
          muted
            ? "text-muted-foreground/70"
            : active
              ? "text-current"
              : "text-foreground",
        )}
      >
        {count}
      </span>
      {style.label}
    </li>
  );
}
