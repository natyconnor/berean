import {
  isDueForLearning,
  isDueForReview,
  isReviewPhase,
  type MemoryStatus,
} from "./memory-scheduler";

export type MemorySessionKind = "learning" | "practice" | "review";

export type MemorySessionLabel = "Learning" | "Practice" | "Review";

export interface MemorySessionCandidate {
  status?: MemoryStatus;
  dueAt?: number;
  lastReviewedAt?: number;
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
 * Review is the due queue: graduated verses whose `dueAt` has arrived.
 */
export function isReviewSessionCandidate(
  candidate: MemorySessionCandidate,
  now: number,
): boolean {
  if (candidate.status === undefined || candidate.dueAt === undefined) {
    return false;
  }
  return isDueForReview(
    {
      status: candidate.status,
      dueAt: candidate.dueAt,
    },
    now,
  );
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
    {
      status: candidate.status,
      dueAt: candidate.dueAt ?? now,
      lastReviewedAt: candidate.lastReviewedAt,
    },
    now,
  );
}

export function isMemorySessionCandidate(
  candidate: MemorySessionCandidate,
  kind: MemorySessionKind,
  now: number,
  includeNew = false,
): boolean {
  if (kind === "learning") {
    return isLearningSessionCandidate(candidate, now, includeNew);
  }
  if (kind === "review") {
    return isReviewSessionCandidate(candidate, now);
  }
  return isPracticeSessionCandidate(candidate);
}
