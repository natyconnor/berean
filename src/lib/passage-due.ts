import { isDueForReview } from "./memory-scheduler";
import { localDayIndex, remainingIntroduces } from "./passage-frontier";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";

export type PassageDueStatus = "building" | "reviewing" | "mastered";

export type PassageDueRow = {
  status: PassageDueStatus;
  dueAt: number;
  pieces: readonly PassagePiece[];
  addsOnDay: number;
  addDayKey?: number;
};

/**
 * Reviewing/mastered passages count as 1 in `memoryStats.due` / `dueQueue`
 * when the passage row itself is due (`isDueForReview`). Building passages
 * are never review-due — they belong in Learning, not Review.
 */
export function isPassageDueForReview(
  row: Pick<PassageDueRow, "status" | "dueAt">,
  now: number,
): boolean {
  if (row.status === "building") return false;
  return isDueForReview(
    {
      status: row.status === "mastered" ? "mastered" : "reviewing",
      dueAt: row.dueAt,
    },
    now,
  );
}

/**
 * A building passage increments `memoryStats.learningDue` by 1 when a
 * learning session is available today:
 * - any introduced non-solid piece (`learning` / `attached`) with `dueAt`
 *   missing or ≤ now, or
 * - an unreached piece with remaining introduces.
 *
 * Soft-locked frontier with no introduces left still allows rope practice
 * from the pack, but must not inflate `learningDue`. Unreached pieces are
 * *not* treated as due merely because `dueAt` is missing — that would count
 * a locked day with leftover unreached pieces as a global Learn card.
 */
export function isPassageDueForLearning(
  row: PassageDueRow,
  now: number,
  tzOffsetMinutes: number,
): boolean {
  if (row.status !== "building") return false;

  const remaining = remainingIntroduces({
    addsOnDay: row.addsOnDay,
    addDayKey: row.addDayKey,
    todayKey: localDayIndex(now, tzOffsetMinutes),
  });
  if (
    remaining > 0 &&
    row.pieces.some((piece) => piece.attachment === "unreached")
  ) {
    return true;
  }

  for (const piece of row.pieces) {
    if (piece.attachment !== "learning" && piece.attachment !== "attached") {
      continue;
    }
    if (piece.dueAt === undefined || piece.dueAt <= now) return true;
  }
  return false;
}

export function countDuePassageReviews(
  rows: readonly Pick<PassageDueRow, "status" | "dueAt">[],
  now: number,
): number {
  let count = 0;
  for (const row of rows) {
    if (isPassageDueForReview(row, now)) count += 1;
  }
  return count;
}

export function countDuePassageLearning(
  rows: readonly PassageDueRow[],
  now: number,
  tzOffsetMinutes: number,
): number {
  let count = 0;
  for (const row of rows) {
    if (isPassageDueForLearning(row, now, tzOffsetMinutes)) count += 1;
  }
  return count;
}

/** Solid / still-attached (on rope, not yet solid) / total frozen pieces. */
export function passageRopeCounts(
  pieces: readonly { attachment: PieceAttachment }[],
): {
  solidCount: number;
  attachedCount: number;
  pieceCount: number;
} {
  let solidCount = 0;
  let attachedCount = 0;
  for (const piece of pieces) {
    if (piece.attachment === "solid") solidCount += 1;
    else if (piece.attachment === "attached") attachedCount += 1;
  }
  return { solidCount, attachedCount, pieceCount: pieces.length };
}

/** Soonest available introduced-piece due, or `now` when only introduces remain. */
export function passageLearningDueAt(
  pieces: readonly PassagePiece[],
  now: number,
): number {
  let min: number | null = null;
  for (const piece of pieces) {
    if (piece.attachment !== "learning" && piece.attachment !== "attached") {
      continue;
    }
    const due = piece.dueAt ?? now;
    if (min === null || due < min) min = due;
  }
  return min ?? now;
}
