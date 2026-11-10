import type { CardReference } from "@/components/study/study-card-model";
import {
  isReviewPhase,
  LEARN_PROGRESS_ACCURACY,
  type MemorySchedule,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import type { PassageStatus } from "@/lib/passage-heart-info";
import { formatVerseRef } from "@/lib/verse-ref-utils";

export interface ReviewSessionAttempt {
  reference: CardReference;
  accuracy: number;
  /** Overrides the reference label (a pack recited as one passage). */
  label?: string;
  /** Whether to offer the per-verse Practice shortcut. Defaults to true. */
  offerPractice?: boolean;
  /** From memory try that followed a refresher. S7 shows the note. */
  refresherUsed?: boolean;
  /** Landed schedule, so a summary row can show the bar and next review. */
  schedule?: Pick<
    MemorySchedule,
    "status" | "learnStage" | "stageReps" | "intervalDays" | "ease" | "dueAt"
  >;
  /** Status the try saved when the row has no `schedule` (an applied held miss). */
  savedStatus?: MemoryStatus;
  /** A Memorized passage reviewed on its Today card, for its summary Refresh. */
  passage?: { packId: string; references: CardReference[] };
  /**
   * Try another refresher's From memory: the row shows it as its latest
   * score, but it is practice, so the average and Refresh skip it.
   */
  displayOnly?: boolean;
}

function counted(
  attempts: readonly ReviewSessionAttempt[],
): ReviewSessionAttempt[] {
  return attempts.filter((attempt) => !attempt.displayOnly);
}

/** Mean accuracy across every counted recitation, including retries. */
export function averageReviewAccuracy(
  attempts: readonly ReviewSessionAttempt[],
): number | null {
  const scored = counted(attempts);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((sum, attempt) => sum + attempt.accuracy, 0) / scored.length,
  );
}

export interface GroupedReviewAttempt extends ReviewSessionAttempt {
  /** Every recitation for this verse, in session order. */
  accuracies: number[];
  /** The last counted recitation's score, which Refresh goes by. */
  countedAccuracy: number;
}

/**
 * Collapse retries onto one row per verse while keeping each recitation's
 * score. First occurrence wins for order, label, and the Practice shortcut.
 * A later recitation can mark the row as a refresher and land its schedule.
 * A display-only try only adds a score to a row a counted try started.
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
      if (attempt.displayOnly) continue;
      indexByKey.set(key, groups.length);
      groups.push({
        ...attempt,
        accuracies: [attempt.accuracy],
        countedAccuracy: attempt.accuracy,
      });
      continue;
    }
    groups[existing].accuracies.push(attempt.accuracy);
    if (attempt.displayOnly) continue;
    groups[existing].countedAccuracy = attempt.accuracy;
    if (attempt.refresherUsed) groups[existing].refresherUsed = true;
    if (attempt.schedule) groups[existing].schedule = attempt.schedule;
    if (attempt.savedStatus) {
      groups[existing].savedStatus = attempt.savedStatus;
    }
  }
  return groups;
}

/**
 * Summary Refresh (R21): a single verse whose last counted try in this
 * summary is under 85% and that the save left Memorized (or Mastered).
 */
export function offersSummaryRefresh(row: GroupedReviewAttempt): boolean {
  if (row.label !== undefined || row.offerPractice === false) return false;
  const status = row.schedule?.status ?? row.savedStatus;
  return (
    row.countedAccuracy < LEARN_PROGRESS_ACCURACY &&
    status !== undefined &&
    isReviewPhase(status)
  );
}

/**
 * Passage summary Refresh (R51): the passage's last counted try in this
 * summary, the only unhinted tries it records, is under 85% and the save left
 * it Memorized (or Mastered). Not its lowest score: "78% → 100%" gets none.
 */
export function offersPassageSummaryRefresh(
  attempts: readonly ReviewSessionAttempt[],
  status: PassageStatus | MemoryStatus | undefined,
): boolean {
  const last = counted(attempts).at(-1);
  return (
    last !== undefined &&
    last.accuracy < LEARN_PROGRESS_ACCURACY &&
    (status === "reviewing" || status === "mastered")
  );
}

export function recalledCopy(accuracies: readonly number[]): string {
  if (accuracies.length <= 1) {
    return `${accuracies[0] ?? 0}% recalled`;
  }
  return `${accuracies.join("%, then ")}% recalled`;
}

/** Session-summary result line when a refresher was used on this try. */
export function refresherResultCopy(accuracies: readonly number[]): string {
  const from = accuracies[0] ?? 0;
  const to = accuracies[accuracies.length - 1] ?? from;
  if (accuracies.length <= 1) return `${to}% · Refresher used`;
  return `${from}% → ${to}% · Refresher used`;
}
