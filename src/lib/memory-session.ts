import {
  isDueForLearning,
  isDueForReview,
  isLearningLocked,
  isLearningPhase,
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

/**
 * Whether this verse still has work left in the current session.
 *
 * Learning is rationed one band per day, so a verse drops out once it
 * soft-locks or graduates. Review is a one-shot due queue: once a grade
 * reschedules the verse (or lapses it out of review), it is spent and the
 * board should Continue to the next due verse or the summary. Practice is
 * optional extra recall with no ration, so it never runs dry.
 */
export function hasSessionWorkLeft(
  kind: MemorySessionKind,
  progress: MemorySessionCandidate,
  now: number,
): boolean {
  if (kind === "practice") return true;
  if (kind === "review") return isReviewSessionCandidate(progress, now);
  if (progress.status === undefined) return false;
  return (
    isLearningPhase(progress.status) &&
    !isLearningLocked(
      {
        status: progress.status,
        dueAt: progress.dueAt ?? now,
        lastReviewedAt: progress.lastReviewedAt,
      },
      now,
    )
  );
}
