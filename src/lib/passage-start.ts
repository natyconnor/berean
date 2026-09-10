import type { VerseSpan } from "./hearted-verse-coverage";
import {
  dueAtInCalendarDays,
  initialSchedule,
  isReviewPhase,
  MAX_LEARN_STAGE,
  type MemorySchedule,
} from "./memory-scheduler";
import {
  inferPieceLearningState,
  looksLikeAutoHeartedPassage,
  matchingAutoHeartSpans,
  type HeartedMemorySpan,
} from "./passage-frontier";
import type { PassagePiece, PassagePieceBase } from "./passage-pieces";
import { canonicalUnifiedSchedule } from "./unified-review-schedule";
import type { VerseScope } from "./verse-scope-match";

export type PassageRowStatus = "building" | "reviewing" | "mastered";

export type PlanStartArgs = {
  pieces: readonly PassagePieceBase[];
  hearts: readonly HeartedMemorySpan[];
  scope: VerseScope;
  /** Pack flag at opt-in; start always clears unified recitation. */
  unifiedEnabled: boolean;
  memberSchedules: readonly MemorySchedule[];
  now: number;
};

export type PlanStartResult = {
  pieces: PassagePiece[];
  status: PassageRowStatus;
  unheartSpans: VerseSpan[];
  unheartedCount: number;
  keptHeartCount: number;
  schedule: MemorySchedule;
};

/**
 * Fresh finished-passage maintenance: reviewing, 1-day interval, due tomorrow.
 * Used when every piece is already solid but there are no review-phase hearts
 * to snapshot (and when the last frontier piece solids).
 */
export function freshReviewingSchedule(
  now: number,
  tzOffsetMinutes?: number,
): MemorySchedule {
  const seed = initialSchedule(now);
  return {
    ...seed,
    status: "reviewing",
    learnStage: MAX_LEARN_STAGE,
    intervalDays: 1,
    dueAt: dueAtInCalendarDays(now, 1, tzOffsetMinutes),
  };
}

/** Conservative opening schedule from review-phase hearts, or a fresh 1-day reviewing seed. */
export function openingMaintenanceSchedule(
  memberSchedules: readonly MemorySchedule[],
  now: number,
): MemorySchedule {
  const reviewMembers = memberSchedules.filter((member) =>
    isReviewPhase(member.status),
  );
  if (reviewMembers.length === 0) return freshReviewingSchedule(now);
  return canonicalUnifiedSchedule(reviewMembers, now);
}

export function assertFrozenPieceBases(
  pieces: readonly PassagePieceBase[],
): void {
  if (pieces.length === 0) {
    throw new Error("Passage pieces are required");
  }
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece || piece.index !== index) {
      throw new Error("Passage pieces must be frozen in Scripture order");
    }
  }
}

function toStoredPiece(
  base: PassagePieceBase,
  state: Pick<PassagePiece, "attachment" | "learnStage" | "stageReps">,
): PassagePiece {
  const piece: PassagePiece = {
    index: base.index,
    book: base.book,
    chapter: base.chapter,
    startVerse: base.startVerse,
    endVerse: base.endVerse,
    sectionIndex: base.sectionIndex,
    attachment: state.attachment,
    learnStage: state.learnStage,
    stageReps: state.stageReps,
  };
  if (base.sectionLabel !== undefined) {
    piece.sectionLabel = base.sectionLabel;
  }
  return piece;
}

function allPiecesSolid(pieces: readonly PassagePiece[]): boolean {
  return (
    pieces.length > 0 && pieces.every((piece) => piece.attachment === "solid")
  );
}

/**
 * Pure start planner. Does not mutate hearts. The mutation layer is
 * create-once: if a passage row already exists, skip this and return the row.
 */
export function planStart(args: PlanStartArgs): PlanStartResult {
  const { pieces, hearts, scope, memberSchedules, now } = args;

  // `new` hearts were seeded on heart and never practiced — do not treat
  // them as learning-phase coverage when freezing pieces.
  const progressHearts = hearts.filter((heart) => heart.status !== "new");
  const inferred = inferPieceLearningState(pieces, progressHearts);
  const nextPieces = pieces.map((piece, index) => {
    const state = inferred[index] ?? {
      attachment: "unreached" as const,
      learnStage: 0,
      stageReps: 0,
    };
    return toStoredPiece(piece, state);
  });

  const autoHearted = looksLikeAutoHeartedPassage(pieces, hearts, scope);
  const unheartSpans = autoHearted
    ? matchingAutoHeartSpans(pieces, hearts).map((span) => ({
        book: span.book,
        chapter: span.chapter,
        startVerse: span.startVerse,
        endVerse: span.endVerse,
      }))
    : [];
  const unheartedCount = unheartSpans.length;
  const keptHeartCount = Math.max(0, hearts.length - unheartedCount);

  const finished = allPiecesSolid(nextPieces);
  const schedule = finished
    ? openingMaintenanceSchedule(memberSchedules, now)
    : initialSchedule(now);

  const status: PassageRowStatus = finished
    ? schedule.status === "mastered"
      ? "mastered"
      : "reviewing"
    : "building";

  return {
    pieces: nextPieces,
    status,
    unheartSpans,
    unheartedCount,
    keptHeartCount,
    schedule,
  };
}
