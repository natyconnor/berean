import {
  isLearningLocked,
  isLearningPhase,
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
): string | null {
  if (isLearningPhase(status)) {
    if (!isLearningLocked({ status, dueAt }, now)) return null;
    // Fall through to the same relative wording as review.
  }

  const diff = dueAt - now;
  if (diff <= 0) return "Due now";

  const days = Math.round(diff / DAY_MS);
  if (days <= 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function formatMemoryStatusSubtitle({
  status,
  statusLabel,
  dueAt,
  now,
}: {
  status: MemoryStatus;
  statusLabel: string;
  dueAt: number;
  now: number;
}): string {
  const dueLabel = formatMemoryDueLabel(status, dueAt, now);
  return dueLabel === null ? statusLabel : `${statusLabel} · ${dueLabel}`;
}
