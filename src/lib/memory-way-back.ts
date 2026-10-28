import { applyBuildingPassageRefresh } from "./passage-frontier";
import type { PieceAttachment } from "./passage-pieces";
import {
  DAY_MS,
  LEARN_PROGRESS_ACCURACY,
  MAX_LEARN_STAGE,
  REVIEW_DAILY_INTERVAL_DAYS,
  REVIEW_EVERY_OTHER_INTERVAL_DAYS,
  REVIEW_LAPSE_ACCURACY,
  REVIEW_LAPSE_LEARN_STAGE,
  dueAtInCalendarDays,
  isDueForLearning,
  isDueForReview,
  isLearningPhase,
  isReviewPhase,
  reviewingIntervalStep,
  type MemorySchedule,
  type MemoryStatus,
} from "./memory-scheduler";

export type RefreshOutcome = "keep-level" | "rung-down";

/** Not `isLearningPhase`, and not the empty-pack flag `showRestart`. */
export type RefreshEligibility = "learned" | "new-or-read";

export type VerseLearnMark = {
  status: MemoryStatus;
  learnStage: number;
};

export type PieceLearnMark = {
  attachment: PieceAttachment;
  learnStage: number;
};

export type RefreshTarget =
  | { scope: "verse"; mark: VerseLearnMark }
  | {
      scope: "group";
      verses: readonly VerseLearnMark[];
      pieces: readonly PieceLearnMark[];
    };

export type AttemptKind =
  "unheld-review" | "held-sitting" | "hinted-check-in" | "practice";

export type AttemptFlags = {
  mode?: string;
  kind?: string;
  hint?: "first-letters";
  holdSchedule?: boolean;
};

export type RefreshFinishGrade = {
  accuracy: number;
  quality: "exact" | "close" | "off";
};

export type RefreshStepGate =
  | { type: "retry" }
  | { type: "advance"; next: 2 | 3 }
  | { type: "passed-final" }
  | { type: "weak-final" };

export type SittingRow = {
  createdAt: number;
  accuracy: number;
  quality: "exact" | "close" | "off";
  holdSchedule?: boolean;
  hint?: "first-letters";
  stage?: number;
  mode?: AttemptFlags["mode"];
  kind?: AttemptFlags["kind"];
};

export type RefreshPlanContext = {
  sittingStartedAt: number;
  now: number;
  overdueMs: number;
  recentLapseCount: number;
  tzOffsetMinutes?: number;
  timeZone?: string;
};

export type ScheduleRefreshTarget = {
  kind: "verse" | "passage-review";
  schedule: MemorySchedule;
  rows: readonly SittingRow[];
  appliedSittingAt?: number;
};

export type BuildingPiece = {
  attachment: PieceAttachment;
  learnStage: number;
  stageReps: number;
  dueAt?: number;
};

export type BuildingRefreshTarget<T extends BuildingPiece = BuildingPiece> = {
  kind: "passage-building";
  pieces: readonly T[];
  rows: readonly SittingRow[];
  appliedSittingAt?: number;
};

export type UnheldReviewCopy = {
  quality: "exact" | "close" | "off";
  accuracy: number;
  hint?: "first-letters";
  stage?: number;
};

export type ScheduleRefreshPlan =
  | { status: "already-applied" }
  | { status: "missing-finish-grade" }
  | {
      status: "apply-schedule";
      outcome: RefreshOutcome;
      schedule: MemorySchedule;
      reviewCopy: UnheldReviewCopy | null;
      appliedSittingAt: number;
    };

export type BuildingRefreshPlan<T extends BuildingPiece = BuildingPiece> =
  | { status: "already-applied" }
  | { status: "missing-finish-grade" }
  | {
      status: "apply-pieces";
      outcome: RefreshOutcome;
      pieces: T[];
      appliedSittingAt: number;
    };

export type MissLog = {
  mode?: AttemptFlags["mode"];
  kind?: AttemptFlags["kind"];
  accuracy: number;
  holdSchedule?: boolean;
};

export type RescueSpendPlan =
  | { status: "unchanged"; sessionSpent: boolean }
  | { status: "restore-daily"; schedule: MemorySchedule; sessionSpent: true };

export type StoredMode = "learn" | "review" | "deck" | "practice";

export function verseRefreshEligibility(
  mark: VerseLearnMark,
): RefreshEligibility {
  if (mark.status === "new" || mark.learnStage === 0) return "new-or-read";
  return "learned";
}

export function refreshEligibility(target: RefreshTarget): RefreshEligibility {
  if (target.scope === "verse") return verseRefreshEligibility(target.mark);
  const verseLearned = target.verses.some(
    (verse) => verseRefreshEligibility(verse) === "learned",
  );
  const pieceLearned = target.pieces.some(
    (piece) => piece.learnStage > 0 || piece.attachment === "solid",
  );
  return verseLearned || pieceLearned ? "learned" : "new-or-read";
}

export function refreshKeepsLevel(finish: RefreshFinishGrade): boolean {
  return (
    finish.quality === "exact" || finish.accuracy >= LEARN_PROGRESS_ACCURACY
  );
}

export function refreshOutcome(finish: RefreshFinishGrade): RefreshOutcome {
  return refreshKeepsLevel(finish) ? "keep-level" : "rung-down";
}

export function refreshStepGate(
  step: 1 | 2 | 3,
  finish: RefreshFinishGrade,
): RefreshStepGate {
  const passed = refreshKeepsLevel(finish);
  if (step === 3) {
    return passed ? { type: "passed-final" } : { type: "weak-final" };
  }
  if (!passed) return { type: "retry" };
  return { type: "advance", next: step === 1 ? 2 : 3 };
}

export function planRefreshFinish<T extends BuildingPiece>(
  target: BuildingRefreshTarget<T>,
  ctx: RefreshPlanContext,
): BuildingRefreshPlan<T>;
export function planRefreshFinish(
  target: ScheduleRefreshTarget,
  ctx: RefreshPlanContext,
): ScheduleRefreshPlan;
export function planRefreshFinish<T extends BuildingPiece>(
  target: ScheduleRefreshTarget | BuildingRefreshTarget<T>,
  ctx: RefreshPlanContext,
): ScheduleRefreshPlan | BuildingRefreshPlan<T> {
  if (target.appliedSittingAt === ctx.sittingStartedAt) {
    return { status: "already-applied" };
  }
  const row = target.rows.find(
    (item) => item.createdAt >= ctx.sittingStartedAt,
  );
  if (!row || row.holdSchedule !== true) {
    return { status: "missing-finish-grade" };
  }
  const outcome = refreshOutcome({
    accuracy: row.accuracy,
    quality: row.quality,
  });
  if (target.kind === "passage-building") {
    return {
      status: "apply-pieces",
      outcome,
      pieces: buildingPieces(target.pieces, outcome, ctx),
      appliedSittingAt: ctx.sittingStartedAt,
    };
  }
  return {
    status: "apply-schedule",
    outcome,
    schedule: applyRefreshSchedule(target.schedule, outcome, ctx),
    reviewCopy: isReviewPhase(target.schedule.status)
      ? {
          quality: row.quality,
          accuracy: row.accuracy,
          ...(row.hint ? { hint: row.hint } : {}),
          ...(row.stage === undefined ? {} : { stage: row.stage }),
        }
      : null,
    appliedSittingAt: ctx.sittingStartedAt,
  };
}

export function planRescueSpend(input: {
  schedule: MemorySchedule;
  recent: readonly MissLog[];
  now: number;
  tzOffsetMinutes?: number;
  timeZone?: string;
}): RescueSpendPlan {
  const miss = input.recent.find((row) => row.holdSchedule !== true);
  const reviewMiss =
    miss !== undefined &&
    (miss.mode === "review" || miss.kind === "review") &&
    miss.accuracy < REVIEW_LAPSE_ACCURACY;
  const dailyChallenge =
    input.schedule.status === "learning" &&
    input.schedule.learnStage === REVIEW_LAPSE_LEARN_STAGE &&
    input.schedule.intervalDays === 0 &&
    input.schedule.dueAt <= input.now;
  if (reviewMiss && dailyChallenge) {
    return {
      status: "restore-daily",
      sessionSpent: true,
      schedule: {
        ...input.schedule,
        status: "reviewing",
        learnStage: MAX_LEARN_STAGE,
        intervalDays: REVIEW_DAILY_INTERVAL_DAYS,
        dueAt: dueAtInCalendarDays(
          input.now,
          1,
          input.tzOffsetMinutes,
          input.timeZone,
        ),
      },
    };
  }
  return {
    status: "unchanged",
    sessionSpent: !stillDueToday(input.schedule, input.now),
  };
}

export function modeToStore(input: {
  requestedMode: StoredMode;
  hint?: "first-letters";
  holdSchedule?: boolean;
  wasDueForReview: boolean;
  scheduleChanged: boolean;
}): StoredMode {
  if (
    input.requestedMode === "practice" &&
    input.hint === undefined &&
    input.holdSchedule !== true &&
    input.wasDueForReview &&
    input.scheduleChanged
  ) {
    return "review";
  }
  return input.requestedMode;
}

export function sameSchedule(a: MemorySchedule, b: MemorySchedule): boolean {
  return (
    a.status === b.status &&
    a.learnStage === b.learnStage &&
    a.stageReps === b.stageReps &&
    a.ease === b.ease &&
    a.intervalDays === b.intervalDays &&
    a.dueAt === b.dueAt &&
    a.consecutiveCorrect === b.consecutiveCorrect &&
    a.lapses === b.lapses &&
    a.earlyReviewApplied === b.earlyReviewApplied
  );
}

export function attemptKind(row: AttemptFlags): AttemptKind | null {
  if (row.holdSchedule === true) return "held-sitting";
  if (row.hint === "first-letters") return "hinted-check-in";
  if (row.mode === "practice") return "practice";
  if (row.mode === "review" || row.kind === "review") return "unheld-review";
  return null;
}

export function isHeldAttempt(row: AttemptFlags): boolean {
  return attemptKind(row) === "held-sitting";
}

export function isHintedOrHeld(row: AttemptFlags): boolean {
  const kind = attemptKind(row);
  return kind === "held-sitting" || kind === "hinted-check-in";
}

export function isUnheldReviewRow(row: AttemptFlags): boolean {
  if (isHeldAttempt(row)) return false;
  return row.mode === "review" || row.kind === "review";
}

function stillDueToday(schedule: MemorySchedule, now: number): boolean {
  return (
    isDueForReview(schedule, now) ||
    isDueForLearning({ ...schedule, lastReviewedAt: undefined }, now)
  );
}

function applyRefreshSchedule(
  schedule: MemorySchedule,
  outcome: RefreshOutcome,
  ctx: RefreshPlanContext,
): MemorySchedule {
  if (outcome === "rung-down") {
    if (isLearningPhase(schedule.status)) {
      return {
        ...schedule,
        learnStage: Math.max(0, schedule.learnStage - 1),
        stageReps: 0,
        dueAt: ctx.now,
        earlyReviewApplied: false,
      };
    }
    const intervalDays = refreshReviewingIntervalDays(schedule, ctx);
    return {
      ...schedule,
      status: "reviewing",
      intervalDays,
      stageReps: 0,
      dueAt: dueAtInCalendarDays(
        ctx.now,
        intervalDays,
        ctx.tzOffsetMinutes,
        ctx.timeZone,
      ),
      earlyReviewApplied: false,
    };
  }
  const tomorrow = dueAtInCalendarDays(
    ctx.now,
    1,
    ctx.tzOffsetMinutes,
    ctx.timeZone,
  );
  return {
    ...schedule,
    dueAt: schedule.dueAt > tomorrow ? schedule.dueAt : tomorrow,
    // Blocks the one early stretch. A same-day exact would otherwise grow the gap.
    earlyReviewApplied: isReviewPhase(schedule.status)
      ? true
      : schedule.earlyReviewApplied,
  };
}

function refreshReviewingIntervalDays(
  schedule: MemorySchedule,
  ctx: RefreshPlanContext,
): number {
  const intervalDays = Math.max(
    REVIEW_DAILY_INTERVAL_DAYS,
    schedule.intervalDays,
  );
  const overdueHeavy = ctx.overdueMs >= 2 * intervalDays * DAY_MS;
  if (overdueHeavy || ctx.recentLapseCount >= 2) {
    return REVIEW_DAILY_INTERVAL_DAYS;
  }
  const step = reviewingIntervalStep(schedule.intervalDays);
  if (step === 1 || step === 2) return REVIEW_DAILY_INTERVAL_DAYS;
  return REVIEW_EVERY_OTHER_INTERVAL_DAYS;
}

function buildingPieces<T extends BuildingPiece>(
  pieces: readonly T[],
  outcome: RefreshOutcome,
  ctx: RefreshPlanContext,
): T[] {
  // Solid pieces are not on the passage interval yet.
  if (pieces.some((piece) => piece.attachment === "solid")) {
    return pieces.map((piece) => ({ ...piece }));
  }
  if (outcome === "rung-down") {
    return applyBuildingPassageRefresh(pieces, ctx.now);
  }
  const tomorrow = dueAtInCalendarDays(
    ctx.now,
    1,
    ctx.tzOffsetMinutes,
    ctx.timeZone,
  );
  return pieces.map((piece) => keepBuildingPiece(piece, tomorrow));
}

function keepBuildingPiece<T extends BuildingPiece>(
  piece: T,
  tomorrow: number,
): T {
  if (piece.attachment === "unreached") return piece;
  if (piece.dueAt !== undefined && piece.dueAt > tomorrow) return piece;
  return { ...piece, dueAt: tomorrow };
}
