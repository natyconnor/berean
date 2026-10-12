import { GraduationCap, Play } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { ProgressCharts } from "@/components/memory/progress/progress-charts";
import {
  progressKpis,
  useProgressActivity,
  type MemoryStats,
  type MemoryStatusCounts,
} from "@/components/memory/progress/use-progress-activity";
import { KpiRow } from "./kpi-row";

/**
 * The Memory progress dashboard: a "Today" hero (keeping Review reachable),
 * a KPI row, and inline SVG/CSS charts. All data is real and reactive; `now` is
 * supplied by the caller (never `Date.now()` inside Convex). Day buckets use
 * the viewer's IANA timezone so streaks and heatmaps follow local midnights.
 *
 * Each section loads independently — Mastery / in-memory KPIs use
 * `memoryStatus` (O(1) rollup) so they are not blocked on the due scan inside
 * `memoryStats`. The Today hero + Review wait on that due half only.
 */
export function MemoryDashboard({
  now,
  stats,
  status,
  onStartReview,
  onStartLearning,
}: {
  now: number;
  stats: MemoryStats | undefined;
  status: MemoryStatusCounts | undefined;
  onStartReview: () => void;
  onStartLearning: () => void;
}) {
  const { activity, forecast } = useProgressActivity(now);

  return (
    <div className="space-y-4">
      {/* Header band: the Today hero and the KPI cluster share a row on large
          screens so the top of the page stops being a near-empty wide card. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-center">
        <TodayHero
          reviewDue={stats?.due}
          learningDue={stats?.learningDue}
          onStartReview={onStartReview}
          onStartLearning={onStartLearning}
        />
        <div className="lg:col-span-2">
          <KpiRow kpis={progressKpis({ activity, status, stats })} />
        </div>
      </div>

      <ProgressCharts
        activity={activity}
        forecast={forecast}
        status={status}
        className="sm:grid-cols-2 xl:grid-cols-4"
      />
    </div>
  );
}

/**
 * The "Today" hero. Undefined dues mean `memoryStats` is still loading;
 * we keep a size-matched skeleton mounted so the header band doesn't jump,
 * then fade the real copy in once the due counts resolve.
 */
function TodayHero({
  reviewDue,
  learningDue,
  onStartReview,
  onStartLearning,
}: {
  reviewDue: number | undefined;
  learningDue: number | undefined;
  onStartReview: () => void;
  onStartLearning: () => void;
}) {
  const reduceMotion = useReducedMotion();

  if (reviewDue === undefined || learningDue === undefined) {
    return (
      <MemoryDashboardCard
        className="min-h-[8.75rem] p-5"
        aria-busy
        aria-label="Loading today's memory work"
      >
        <div
          className="flex flex-wrap items-center justify-between gap-4"
          aria-hidden
        >
          <div className="min-w-0 space-y-2">
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            <div className="h-7 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-[5.75rem] animate-pulse rounded-md bg-muted" />
        </div>
      </MemoryDashboardCard>
    );
  }

  const totalDue = reviewDue + learningDue;
  const headline =
    totalDue === 0
      ? "All caught up"
      : learningDue > 0 && reviewDue > 0
        ? `${learningDue} to learn · ${reviewDue} to review`
        : learningDue > 0
          ? `${learningDue} to learn today`
          : `${reviewDue} due today`;
  const subtitle =
    totalDue === 0
      ? "No verses need learning or review right now."
      : learningDue > 0 && reviewDue > 0
        ? "Continue learning sessions, then clear today's reviews."
        : learningDue > 0
          ? "Finish today's learning sessions on your hearted verses."
          : "Review your hearted verses across every session.";

  return (
    <MemoryDashboardCard className="min-h-[8.75rem] p-5">
      <motion.div
        className="flex flex-wrap items-center justify-between gap-4"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Today
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {headline}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {learningDue > 0 ? (
            <Button
              size="lg"
              variant="outline"
              onClick={onStartLearning}
              className="gap-1.5"
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
              Continue Learning
            </Button>
          ) : null}
          <Button
            size="lg"
            onClick={onStartReview}
            disabled={reviewDue === 0}
            className="gap-1.5"
          >
            <Play className="h-4 w-4" />
            Review
          </Button>
        </div>
      </motion.div>
    </MemoryDashboardCard>
  );
}
