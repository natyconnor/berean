import {
  isLearningProgressAttempt,
  isLearningSessionEndingStage,
  MAX_LEARN_STAGE,
  nextLearningSessionDueAt,
  requiredRepsFor,
  type MemoryStatus,
} from "@/lib/memory-scheduler";

export interface VersePracticeProgress {
  learnStage: number;
  stageReps: number;
  status: MemoryStatus;
  /** Present when known; used for learning soft-lock UI. */
  dueAt?: number;
}

export type VerseAttemptQuality = "exact" | "close" | "off";

export function normalizeVerseProgress(
  raw: Pick<VersePracticeProgress, "learnStage" | "stageReps" | "status"> & {
    dueAt?: number;
  },
): VersePracticeProgress {
  return {
    learnStage: normalizeStageIndex(raw.learnStage),
    stageReps: normalizeReps(raw.stageReps),
    status: normalizeStatus(raw.status),
    ...(raw.dueAt !== undefined ? { dueAt: raw.dueAt } : {}),
  };
}

export function normalizeStageIndex(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.min(MAX_LEARN_STAGE, Math.max(0, Math.trunc(stage)));
}

export function normalizeReps(reps: number): number {
  if (!Number.isFinite(reps)) return 0;
  return Math.max(0, Math.trunc(reps));
}

export function normalizeStatus(
  status: MemoryStatus | undefined,
): MemoryStatus {
  if (
    status === "new" ||
    status === "learning" ||
    status === "reviewing" ||
    status === "mastered"
  ) {
    return status;
  }
  return "learning";
}

/**
 * Local mirror of the scheduler's learning-phase transition, used only as a
 * fallback when a recorded attempt resolves to `null` so the UI still advances
 * instead of stalling. On the normal path we adopt the server schedule instead.
 *
 * When `now` is provided, session-ending band clears push `dueAt` out by a day
 * so the UI still reads as soft-locked. The server lands the exact next-local-
 * day timestamp; nothing is persisted on this path, so an approximation is fine.
 */
export function predictLearning(
  stage: number,
  reps: number,
  quality: VerseAttemptQuality,
  accuracy: number,
  wordCount?: number,
  status: MemoryStatus = "learning",
  now?: number,
): VersePracticeProgress {
  if (isLearningProgressAttempt(quality, accuracy)) {
    const nextReps = reps + 1;
    if (nextReps >= requiredRepsFor(stage, wordCount)) {
      if (stage >= MAX_LEARN_STAGE) {
        return {
          learnStage: MAX_LEARN_STAGE,
          stageReps: 0,
          status: "reviewing",
          ...(now !== undefined ? { dueAt: now } : {}),
        };
      }
      const sessionEnding = isLearningSessionEndingStage(stage);
      return {
        learnStage: stage + 1,
        stageReps: 0,
        status: "learning",
        ...(now !== undefined
          ? {
              dueAt: sessionEnding ? nextLearningSessionDueAt(now) : now,
            }
          : {}),
      };
    }
    return {
      learnStage: stage,
      stageReps: nextReps,
      status: "learning",
      ...(now !== undefined ? { dueAt: now } : {}),
    };
  }
  if (quality === "off") {
    if (reps > 0) {
      return {
        learnStage: stage,
        stageReps: reps - 1,
        status: "learning",
        ...(now !== undefined ? { dueAt: now } : {}),
      };
    }
    if (stage > 0) {
      const prevStage = stage - 1;
      return {
        learnStage: prevStage,
        stageReps: Math.max(0, requiredRepsFor(prevStage, wordCount) - 1),
        status: "learning",
        ...(now !== undefined ? { dueAt: now } : {}),
      };
    }
    return {
      learnStage: 0,
      stageReps: 0,
      status: "learning",
      ...(now !== undefined ? { dueAt: now } : {}),
    };
  }
  return {
    learnStage: stage,
    stageReps: reps,
    status,
    ...(now !== undefined ? { dueAt: now } : {}),
  };
}
