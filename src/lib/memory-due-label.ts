import {
  isLearningLocked,
  isLearningPhase,
  type MemorySchedule,
  type MemoryStatus,
} from "@/lib/memory-scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Human-readable due label for library / detail subtitles.
 *
 * Review-phase verses always get a due label. Learning-phase verses only get
 * one when soft-locked (`dueAt` in the future) — e.g. "Tomorrow" after today's
 * session ends. Available learning verses return null so the subtitle stays
 * just the status label.
 */
export function formatMemoryDueLabel(
  status: MemoryStatus,
  dueAt: number,
  now: number,
  lastReviewedAt?: number,
): string | null {
  if (isLearningPhase(status)) {
    if (!isLearningLocked({ status, dueAt, lastReviewedAt }, now)) return null;
    // Locked learning is always "come back tomorrow", even when the next
    // local midnight is still "today" on the calendar rounding used below.
    return "Tomorrow";
  }

  const diff = dueAt - now;
  if (diff <= 0) return "Due now";

  const days = Math.round(diff / DAY_MS);
  if (days <= 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * Relative due copy for review-result banners ("in 2 days", "tomorrow").
 * Returns null when the next schedule has not arrived yet so the UI can omit
 * the clause instead of flashing a "soon" placeholder.
 */
export function formatNextReviewPhrase(
  schedule: Pick<MemorySchedule, "status" | "dueAt"> | null | undefined,
  now: number,
): string | null {
  if (!schedule) return null;
  if (isLearningPhase(schedule.status)) return "soon";
  return (
    formatMemoryDueLabel(schedule.status, schedule.dueAt, now)?.toLowerCase() ??
    "soon"
  );
}

export function formatMemoryStatusSubtitle({
  status,
  statusLabel,
  dueAt,
  now,
  lastReviewedAt,
}: {
  status: MemoryStatus;
  statusLabel: string;
  dueAt: number;
  now: number;
  lastReviewedAt?: number;
}): string {
  const dueLabel = formatMemoryDueLabel(status, dueAt, now, lastReviewedAt);
  return dueLabel === null ? statusLabel : `${statusLabel} · ${dueLabel}`;
}
