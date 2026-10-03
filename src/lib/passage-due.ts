import { isDueForReview } from "./memory-scheduler";
import {
  coerceUnstartedLearningPieces,
  localDayIndex,
  remainingIntroduces,
} from "./passage-frontier";
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

/**
 * Skinny cache of the piece facts due queries need. Convex cannot omit
 * `pieces` from a `passageMemory` read, so aggregations must not collect
 * those documents. Keep {@link isPassageDueForLearning} as the source of
 * truth; this projection is written on every passage insert/patch.
 *
 * `minIntroducedDueAt` is the min `dueAt` among learning/attached pieces,
 * using `0` when a piece has no `dueAt` (always due). Omitted when there are
 * no introduced pieces.
 */
export type PassageDueProjection = {
  status: PassageDueStatus;
  dueAt: number;
  learningDueAt: number;
  addsOnDay: number;
  addDayKey?: number;
  hasUnreached: boolean;
  hasIntroduced: boolean;
  minIntroducedDueAt?: number;
  solidCount: number;
  attachedCount: number;
  pieceCount: number;
};

/** Project a passage row for due/forecast/list reads. Coerces freeze-time pieces. */
export function projectPassageDue(
  row: PassageDueRow,
  now: number,
): PassageDueProjection {
  const pieces = coerceUnstartedLearningPieces(row.pieces);
  let hasUnreached = false;
  let hasIntroduced = false;
  let minIntroducedDueAt: number | undefined;
  for (const piece of pieces) {
    if (piece.attachment === "unreached") hasUnreached = true;
    if (piece.attachment === "learning" || piece.attachment === "attached") {
      hasIntroduced = true;
      const due = piece.dueAt ?? 0;
      if (minIntroducedDueAt === undefined || due < minIntroducedDueAt) {
        minIntroducedDueAt = due;
      }
    }
  }
  const rope = passageRopeCounts(pieces);
  return {
    status: row.status,
    dueAt: row.dueAt,
    learningDueAt: passageLearningDueAt(pieces, now),
    addsOnDay: row.addsOnDay,
    addDayKey: row.addDayKey,
    hasUnreached,
    hasIntroduced,
    ...(hasIntroduced ? { minIntroducedDueAt } : {}),
    solidCount: rope.solidCount,
    attachedCount: rope.attachedCount,
    pieceCount: rope.pieceCount,
  };
}

/**
 * Same rules as {@link isPassageDueForLearning}, using the cached piece
 * facts instead of the piece array.
 */
export function isProjectedPassageDueForLearning(
  row: PassageDueProjection,
  now: number,
  tzOffsetMinutes: number,
): boolean {
  if (row.status !== "building") return false;

  const remaining = remainingIntroduces({
    addsOnDay: row.addsOnDay,
    addDayKey: row.addDayKey,
    todayKey: localDayIndex(now, tzOffsetMinutes),
  });
  if (remaining > 0 && row.hasUnreached) return true;
  if (!row.hasIntroduced) return false;
  return (row.minIntroducedDueAt ?? 0) <= now;
}

export function countProjectedPassageLearning(
  rows: readonly PassageDueProjection[],
  now: number,
  tzOffsetMinutes: number,
): number {
  let count = 0;
  for (const row of rows) {
    if (isProjectedPassageDueForLearning(row, now, tzOffsetMinutes)) count += 1;
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
