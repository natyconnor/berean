import {
  EASE_START,
  isLearningPhase,
  scheduleNext,
  type MemorySchedule,
  type MemoryStatus,
  type ReviewInput,
} from "@/lib/memory-scheduler";

/**
 * Live schedule fields the client already has when a review card opens.
 * Optional numbers are filled from scheduler defaults when present; a
 * reviewing-phase row without `intervalDays` cannot preview a due date.
 */
export type MemoryScheduleSnapshot = {
  status: MemoryStatus;
  learnStage: number;
  stageReps: number;
  dueAt: number;
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
};

/**
 * Hydrate a full {@link MemorySchedule} from the snapshot a session card
 * already holds. Returns null when a reviewing-phase preview would have to
 * invent an interval (which would flash the wrong "in N days").
 */
export function memoryScheduleFromSnapshot(
  snapshot: MemoryScheduleSnapshot,
): MemorySchedule | null {
  if (
    !isLearningPhase(snapshot.status) &&
    snapshot.intervalDays === undefined
  ) {
    return null;
  }
  return {
    status: snapshot.status,
    learnStage: snapshot.learnStage,
    stageReps: snapshot.stageReps,
    dueAt: snapshot.dueAt,
    ease: snapshot.ease ?? EASE_START,
    intervalDays: snapshot.intervalDays ?? 0,
    consecutiveCorrect: snapshot.consecutiveCorrect ?? 0,
    lapses: snapshot.lapses ?? 0,
    earlyReviewApplied: snapshot.earlyReviewApplied ?? false,
  };
}

/**
 * Client-side `scheduleNext` so review banners can show "in N days" on Check
 * instead of waiting for `recordAttempt`. Same inputs as the mutation: pass
 * the attempt's `now` and timezone so the due label matches the server.
 */
export function previewNextSchedule(
  snapshot: MemoryScheduleSnapshot,
  input: ReviewInput,
): MemorySchedule | null {
  const current = memoryScheduleFromSnapshot(snapshot);
  if (!current) return null;
  return scheduleNext(current, {
    ...input,
    tzOffsetMinutes:
      input.tzOffsetMinutes ?? new Date(input.now).getTimezoneOffset(),
  });
}
