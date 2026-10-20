import {
  isLearningLocked,
  isLearningPhase,
  type MemorySchedule,
  type MemoryStatus,
} from "@/lib/memory-scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;

function localCalendarDaysUntil(dueAt: number, now: number): number {
  const due = new Date(dueAt);
  const current = new Date(now);
  return (
    (Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) -
      Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())) /
    DAY_MS
  );
}

function lockedLearningDueLabel(days: number): string {
  if (days <= 0) return "Later today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function formatUnlockClock(dueAt: number): string {
  return new Date(dueAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type MemoryStatusLabelInput = {
  status: MemoryStatus;
  statusLabel: string;
  dueAt: number;
  now: number;
  lastReviewedAt?: number;
};

export type MemoryStatusCaption = {
  text: string;
  title?: string;
  accessibleName?: string;
};

/**
 * Human-readable due label for library / detail subtitles.
 *
 * Review-phase verses always get a due label. Learning-phase verses only get
 * one when soft-locked (`dueAt` in the future). The lock wording follows the
 * same local calendar-day buckets as reviewing: later today, tomorrow, or in
 * N days. Available learning verses return null so the subtitle stays just
 * the status label.
 */
export function formatMemoryDueLabel(
  status: MemoryStatus,
  dueAt: number,
  now: number,
  lastReviewedAt?: number,
): string | null {
  if (isLearningPhase(status)) {
    if (!isLearningLocked({ status, dueAt, lastReviewedAt }, now)) return null;
    return lockedLearningDueLabel(localCalendarDaysUntil(dueAt, now));
  }

  const diff = dueAt - now;
  if (diff <= 0) return "Due now";

  const days = localCalendarDaysUntil(dueAt, now);
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

/**
 * Review gap as a count of days ("1 day", "5 days").
 * Returns null when there is no real wait to name.
 */
export function formatReviewIntervalPhrase(
  intervalDays: number | undefined,
): string | null {
  if (intervalDays === undefined || !Number.isFinite(intervalDays)) {
    return null;
  }
  const days = Math.max(1, Math.round(intervalDays));
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatMemoryStatusCaption({
  status,
  statusLabel,
  dueAt,
  now,
  lastReviewedAt,
}: MemoryStatusLabelInput): MemoryStatusCaption {
  const dueLabel = formatMemoryDueLabel(status, dueAt, now, lastReviewedAt);
  const text = dueLabel === null ? statusLabel : `${statusLabel} · ${dueLabel}`;
  if (dueLabel === null || !isLearningPhase(status)) {
    return { text };
  }

  const days = localCalendarDaysUntil(dueAt, now);
  const time = formatUnlockClock(dueAt);
  if (days <= 0) {
    return {
      text,
      title: `Unlocks at ${time}`,
      accessibleName: `${statusLabel}, unlocks later today at ${time}`,
    };
  }
  if (days === 1) {
    return {
      text,
      title: `Unlocks tomorrow at ${time}`,
      accessibleName: `${statusLabel}, unlocks tomorrow at ${time}`,
    };
  }
  return {
    text,
    title: `Unlocks in ${days} days at ${time}`,
    accessibleName: `${statusLabel}, unlocks in ${days} days at ${time}`,
  };
}

export function formatMemoryStatusSubtitle(
  input: MemoryStatusLabelInput,
): string {
  return formatMemoryStatusCaption(input).text;
}
