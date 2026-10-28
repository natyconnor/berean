import type { CardReference } from "@/components/study/study-card-model";
import {
  REVIEW_LAPSE_ACCURACY,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import { formatVerseRef } from "@/lib/verse-ref-utils";

export interface ReviewSessionAttempt {
  reference: CardReference;
  accuracy: number;
  /** Overrides the reference label (a pack recited as one passage). */
  label?: string;
  /** Whether to offer the per-verse Practice shortcut. Defaults to true. */
  offerPractice?: boolean;
  status?: MemoryStatus;
}

/** Mean accuracy across every recitation, including retries. */
export function averageReviewAccuracy(
  attempts: readonly ReviewSessionAttempt[],
): number | null {
  if (attempts.length === 0) return null;
  return Math.round(
    attempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) /
      attempts.length,
  );
}

export interface GroupedReviewAttempt extends ReviewSessionAttempt {
  /** Every recitation for this verse, in session order. */
  accuracies: number[];
}

/**
 * Collapse retries onto one row per verse while keeping each recitation's
 * score. First occurrence wins for order, label, and the Practice shortcut.
 */
export function groupReviewSessionAttempts(
  attempts: readonly ReviewSessionAttempt[],
): GroupedReviewAttempt[] {
  const groups: GroupedReviewAttempt[] = [];
  const indexByKey = new Map<string, number>();
  for (const attempt of attempts) {
    const key = attempt.label ?? formatVerseRef(attempt.reference);
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({ ...attempt, accuracies: [attempt.accuracy] });
      continue;
    }
    groups[existing]?.accuracies.push(attempt.accuracy);
  }
  return groups;
}

export function recalledCopy(accuracies: readonly number[]): string {
  if (accuracies.length <= 1) {
    return `${accuracies[0] ?? 0}% recalled`;
  }
  const last = accuracies[accuracies.length - 1] ?? 0;
  const earlier = accuracies.slice(0, -1).join("%, ");
  return `${earlier}%, then ${last}% recalled`;
}

/** True when the latest recitation dropped below the lapse bar. */
export function lastTryNeedsRefresh(accuracies: readonly number[]): boolean {
  const last = accuracies[accuracies.length - 1];
  return last !== undefined && last < REVIEW_LAPSE_ACCURACY;
}
