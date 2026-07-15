import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { cn } from "@/lib/utils";

/**
 * Shared chart-card geometry so skeletons and loaded widgets reserve the same
 * footprint. Sized for the tallest common layout (header + metric + h-24 chart
 * + axis labels) so the dashboard row doesn't grow when aggregates resolve.
 */
export const chartCardClassName =
  "flex h-full min-h-[13.5rem] flex-col p-4 sm:min-h-[14.5rem]";

const REVEAL = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Fade + slight rise when a chart finishes loading into a reserved slot. */
export function ChartReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("h-full", className)}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={REVEAL}
    >
      {children}
    </motion.div>
  );
}

/**
 * Swaps skeleton → content inside a height-reserved slot with a crossfade /
 * slide so the library below doesn't snap when aggregates resolve.
 */
export function ChartSlot({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative h-full min-h-[13.5rem] sm:min-h-[14.5rem]">
      <AnimatePresence mode="popLayout" initial={false}>
        {loading ? (
          <motion.div
            key="skeleton"
            className="h-full"
            initial={false}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, transition: { duration: 0.18 } }
            }
          >
            {skeleton}
          </motion.div>
        ) : (
          <ChartReveal key="content">{children}</ChartReveal>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Placeholder card that mirrors chart header + body proportions. */
export function ChartSkeleton({ title }: { title: string }) {
  return (
    <MemoryDashboardCard
      className={chartCardClassName}
      aria-busy="true"
      aria-label={`Loading ${title}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <div className="h-3 w-12 animate-pulse rounded bg-muted" aria-hidden />
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-2.5" aria-hidden>
        <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        <div className="min-h-0 flex-1 animate-pulse rounded-md bg-muted/80" />
        <div className="flex justify-between gap-2">
          <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </MemoryDashboardCard>
  );
}
