import { isLearningPhase, type MemoryStatus } from "@/lib/memory-scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatMemoryDueLabel(
  status: MemoryStatus,
  dueAt: number,
  now: number,
): string | null {
  if (isLearningPhase(status)) return null;

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
