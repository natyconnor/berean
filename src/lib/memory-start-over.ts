import { initialSchedule, type MemorySchedule } from "./memory-scheduler";

/** Reset a verse to New/Read, due now, with no last review stamped. */
export function startOverVersePatch(now: number): MemorySchedule & {
  lastReviewedAt: undefined;
} {
  return {
    ...initialSchedule(now),
    lastReviewedAt: undefined,
  };
}

/** Verse-page history: tries at or after the last Start over, else all of them. */
export function attemptsSinceStartOver<T extends { createdAt: number }>(
  attempts: readonly T[],
  startedOverAt: number | undefined,
): T[] {
  if (startedOverAt === undefined) return [...attempts];
  return attempts.filter((attempt) => attempt.createdAt >= startedOverAt);
}
