import type { MemorySchedule } from "./memory-scheduler";
import type { PassagePiece } from "./passage-pieces";

export type StartOverSnapshot = MemorySchedule & {
  lastReviewedAt?: number;
};

export function snapshotSchedule(
  row: MemorySchedule & { lastReviewedAt?: number },
): StartOverSnapshot {
  return {
    status: row.status,
    learnStage: row.learnStage,
    stageReps: row.stageReps,
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    earlyReviewApplied: row.earlyReviewApplied,
    ...(row.lastReviewedAt === undefined
      ? {}
      : { lastReviewedAt: row.lastReviewedAt }),
  };
}

export function startOverPassagePieces(
  pieces: readonly PassagePiece[],
  indexes: ReadonlySet<number>,
): PassagePiece[] {
  return pieces.map((piece) => {
    if (!indexes.has(piece.index)) return piece;
    return {
      ...piece,
      attachment: "unreached",
      learnStage: 0,
      stageReps: 0,
      dueAt: undefined,
    };
  });
}
