import {
  isDueForLearning,
  isReviewPhase,
  type MemoryStatus,
} from "./memory-scheduler";

export type MemorySessionKind = "learning" | "practice";

export interface MemorySessionCandidate {
  status?: MemoryStatus;
  dueAt?: number;
}

/**
 * Practice is optional extra recall for verses that have graduated from the
 * learning ladder. It intentionally excludes new and in-progress verses.
 */
export function isPracticeSessionCandidate(
  candidate: MemorySessionCandidate,
): boolean {
  return candidate.status !== undefined && isReviewPhase(candidate.status);
}

/**
 * An unscoped Learning session contains only started verses that are available
 * today. A scoped Learn CTA may also start a brand-new verse.
 */
export function isLearningSessionCandidate(
  candidate: MemorySessionCandidate,
  now: number,
  includeNew: boolean,
): boolean {
  if (candidate.status === undefined) return includeNew;
  if (candidate.status === "new") return includeNew;
  return isDueForLearning(
    { status: candidate.status, dueAt: candidate.dueAt ?? now },
    now,
  );
}

export function isMemorySessionCandidate(
  candidate: MemorySessionCandidate,
  kind: MemorySessionKind,
  now: number,
  includeNew = false,
): boolean {
  return kind === "learning"
    ? isLearningSessionCandidate(candidate, now, includeNew)
    : isPracticeSessionCandidate(candidate);
}
