import {
  passageHeartSpans,
  spanCoveredBy,
  type VerseSpan,
} from "./hearted-verse-coverage";
import {
  dueAtInCalendarDays,
  initialSchedule,
  isReviewPhase,
  MAX_LEARN_STAGE,
  type MemorySchedule,
} from "./memory-scheduler";
import {
  inferPieceLearningState,
  type HeartedMemorySpan,
} from "./passage-frontier";
import { spansOverlapAny } from "./memorize-status";
import type { PassagePiece, PassagePieceBase } from "./passage-pieces";
import { spanInRange, type PassageRange } from "./passage-range";
import { canonicalUnifiedSchedule } from "./unified-review-schedule";
import { verseMatchesScope, type VerseScope } from "./verse-scope-match";

export type PassageRowStatus = "building" | "reviewing" | "mastered";

export type PlanStartArgs = {
  pieces: readonly PassagePieceBase[];
  hearts: readonly HeartedMemorySpan[];
  scope: VerseScope;
  /** Pack flag at opt-in; start always clears unified recitation. */
  unifiedEnabled: boolean;
  memberSchedules: readonly MemorySchedule[];
  now: number;
  tzOffsetMinutes?: number;
};

export type PlanStartResult = {
  pieces: PassagePiece[];
  status: PassageRowStatus;
  schedule: MemorySchedule;
};

/**
 * Verse items a newly started passage absorbs: in Memory on their own (no
 * custom pack keeps them separate) and fully inside the passage's chapter
 * spans. Their progress has already seeded the pieces, so they stop being
 * separate items and nothing is due twice.
 */
export function absorbedVerseItems<
  T extends VerseSpan & { inCustomPack: boolean },
>(items: readonly T[], pieces: readonly VerseSpan[]): T[] {
  const passageSpans = passageHeartSpans(pieces);
  return items.filter(
    (item) => !item.inCustomPack && spanCoveredBy(item, passageSpans),
  );
}

/**
 * The first passage whose verses (chapter spans, see `passageHeartSpans`)
 * share any verse with `pieces`, or null. Two passages over the same verses
 * would be due twice.
 */
export function findOverlappingPassage<
  T extends { pieces: readonly VerseSpan[] },
>(pieces: readonly VerseSpan[], passages: readonly T[]): T | null {
  const spans = passageHeartSpans(pieces);
  return (
    passages.find((passage) =>
      spansOverlapAny(spans, passageHeartSpans(passage.pieces)),
    ) ?? null
  );
}

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
  tzOffsetMinutes?: number,
): MemorySchedule {
  const reviewMembers = memberSchedules.filter((member) =>
    isReviewPhase(member.status),
  );
  if (reviewMembers.length === 0) {
    return freshReviewingSchedule(now, tzOffsetMinutes);
  }
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
    if (
      !Number.isFinite(piece.startVerse) ||
      !Number.isFinite(piece.endVerse) ||
      piece.startVerse < 1 ||
      piece.endVerse < piece.startVerse
    ) {
      throw new Error("Passage pieces must use valid verse spans");
    }
  }
}

/**
 * Ensure client-supplied frozen pieces lie inside the pack's chapters and
 * form a Scripture walk (same book, non-overlapping, non-decreasing). With a
 * passage `range`, they must also stay inside it and cover it exactly, in
 * order (see {@link assertPiecesCoverRange}).
 */
export function assertPiecesMatchScope(
  pieces: readonly PassagePieceBase[],
  scope: VerseScope,
  range: PassageRange | null = null,
): void {
  assertFrozenPieceBases(pieces);
  let previous: PassagePieceBase | undefined;
  for (const piece of pieces) {
    if (
      !verseMatchesScope({ book: piece.book, chapter: piece.chapter }, scope)
    ) {
      throw new Error("Passage pieces must stay within the passage");
    }
    if (previous) {
      if (piece.book !== previous.book) {
        throw new Error("Passage pieces must stay in one contiguous book");
      }
      if (piece.chapter < previous.chapter) {
        throw new Error("Passage pieces must stay in Scripture order");
      }
      if (
        piece.chapter === previous.chapter &&
        piece.startVerse <= previous.endVerse
      ) {
        throw new Error("Passage pieces must not overlap");
      }
    }
    previous = piece;
  }
  if (range) assertPiecesCoverRange(pieces, range);
}

/**
 * Pieces (already in order and non-overlapping) stay inside the range, start
 * on its first verse, end on its last, and leave no gap. Pieces are built
 * from fetched text and the ESV omits a few verses (Matthew 17:21), so a gap
 * of one verse inside a chapter is allowed.
 */
function assertPiecesCoverRange(
  pieces: readonly PassagePieceBase[],
  range: PassageRange,
): void {
  const uncovered = "Passage pieces must cover the whole passage in order";
  let previous: PassagePieceBase | undefined;
  for (const piece of pieces) {
    if (!spanInRange(piece, range)) {
      throw new Error("Passage pieces must stay within the passage");
    }
    if (previous) {
      const joins =
        piece.chapter === previous.chapter
          ? piece.startVerse - previous.endVerse <= 2
          : piece.chapter === previous.chapter + 1 && piece.startVerse === 1;
      if (!joins) throw new Error(uncovered);
    }
    previous = piece;
  }

  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  if (
    !first ||
    !last ||
    first.chapter !== range.startChapter ||
    first.startVerse !== range.startVerse ||
    last.chapter !== range.endChapter ||
    last.endVerse !== range.endVerse
  ) {
    throw new Error(uncovered);
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
  if (state.attachment !== "unreached") {
    piece.carriedOver = true;
  }
  return piece;
}

function allPiecesSolid(pieces: readonly PassagePiece[]): boolean {
  return (
    pieces.length > 0 && pieces.every((piece) => piece.attachment === "solid")
  );
}

/**
 * Pure start planner. Never touches hearts. The mutation layer is
 * create-once: if a passage row already exists, skip this and return the row.
 * Pieces seeded from existing verse progress are marked `carriedOver`.
 */
export function planStart(args: PlanStartArgs): PlanStartResult {
  const { pieces, hearts, memberSchedules, now } = args;

  // `new` members are Up next and were never practiced — do not treat them
  // as learning-phase coverage when freezing pieces. `learning` members
  // still at Read with no reps are also unreached
  // ({@link inferPieceLearningState}).
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

  const finished = allPiecesSolid(nextPieces);
  const schedule = finished
    ? openingMaintenanceSchedule(memberSchedules, now, args.tzOffsetMinutes)
    : initialSchedule(now);

  const status: PassageRowStatus = finished
    ? schedule.status === "mastered"
      ? "mastered"
      : "reviewing"
    : "building";

  return {
    pieces: nextPieces,
    status,
    schedule,
  };
}
