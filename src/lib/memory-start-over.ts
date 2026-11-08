import { initialSchedule, type MemorySchedule } from "./memory-scheduler";
import type { PassagePiece } from "./passage-pieces";

/** Reset a verse to New/Read, due now, with no last review stamped. */
export function startOverVersePatch(now: number): MemorySchedule & {
  lastReviewedAt: undefined;
} {
  return {
    ...initialSchedule(now),
    lastReviewedAt: undefined,
  };
}

/** Verse-page or passage-page history: tries at or after the last Start over. */
export function attemptsSinceStartOver<T extends { createdAt: number }>(
  attempts: readonly T[],
  startedOverAt: number | undefined,
): T[] {
  if (startedOverAt === undefined) return [...attempts];
  return attempts.filter((attempt) => attempt.createdAt >= startedOverAt);
}

/** Every piece goes back to unreached so the passage re-enters through intake. */
export function startOverPassagePieces(
  pieces: readonly PassagePiece[],
): PassagePiece[] {
  return pieces.map((piece) => ({
    ...piece,
    attachment: "unreached",
    learnStage: 0,
    stageReps: 0,
    dueAt: undefined,
  }));
}

export type PassageSessionCounters = {
  lastSessionAt?: number;
  addsOnDay: number;
  addDayKey?: number;
};

/** Whole-passage Start over returns the session counters to never-started. */
export function startOverPassageSession(): PassageSessionCounters {
  return { addsOnDay: 0 };
}

/** Passage row after Start over: learning, due now, pieces unreached. */
export function startOverPassagePatch(
  pieces: readonly PassagePiece[],
  now: number,
) {
  const seed = initialSchedule(now);
  const session = startOverPassageSession();
  return {
    pieces: startOverPassagePieces(pieces),
    status: "building" as const,
    ease: seed.ease,
    intervalDays: seed.intervalDays,
    dueAt: now,
    consecutiveCorrect: seed.consecutiveCorrect,
    lapses: seed.lapses,
    stageReps: seed.stageReps,
    earlyReviewApplied: seed.earlyReviewApplied,
    startedOverAt: now,
    shakyVerses: undefined,
    lastSessionAt: session.lastSessionAt,
    addsOnDay: session.addsOnDay,
    addDayKey: session.addDayKey,
    celebratedAt: undefined,
    celebrationPendingAt: undefined,
  };
}
