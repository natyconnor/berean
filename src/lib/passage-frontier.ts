import {
  exactSpanMatch,
  overlappingSpans,
  spanCoversVerse,
  type VerseSpan,
} from "./hearted-verse-coverage";
import {
  DAY_MS,
  dueAtInCalendarDays,
  isLearningLocked,
  isLearningPhase,
  isLearningSessionEndingStage,
  isReviewPhase,
  LEARN_PROGRESS_ACCURACY,
  MAX_LEARN_STAGE,
  requiredRepsFor,
  type MemoryStatus,
} from "./memory-scheduler";
import type {
  PassagePiece,
  PassagePieceBase,
  PieceAttachment,
} from "./passage-pieces";
import { scopeCoverageComplete } from "./scope-verse-coverage";
import { countVerseWords, hintForProgress, maskVerseText } from "./verse-hint";
import type { VerseScope } from "./verse-scope-match";

export const PASSAGE_MAX_ADDS_PER_DAY = 5;
export const PASSAGE_REHEARSAL_MAX_PIECES = 3;
export const PASSAGE_REHEARSAL_MAX_WORDS = 120;
/** Offer a pair-connect after every N attached/solid pieces. */
export const PASSAGE_CONNECT_EVERY_N = 2;
export const PASSAGE_PASS_ACCURACY = LEARN_PROGRESS_ACCURACY;

export type HeartedMemorySpan = VerseSpan & {
  status: MemoryStatus;
  learnStage?: number;
  stageReps?: number;
};

function isRopeAttachment(attachment: PieceAttachment): boolean {
  return attachment === "attached" || attachment === "solid";
}

function pieceSpan(piece: PassagePieceBase): VerseSpan {
  return {
    book: piece.book,
    chapter: piece.chapter,
    startVerse: piece.startVerse,
    endVerse: piece.endVerse,
  };
}

function versesFullyCovered(
  piece: PassagePieceBase,
  hearts: readonly VerseSpan[],
): boolean {
  for (let verse = piece.startVerse; verse <= piece.endVerse; verse += 1) {
    if (
      !hearts.some(
        (heart) =>
          heart.book === piece.book &&
          heart.chapter === piece.chapter &&
          spanCoversVerse(heart, verse),
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Local calendar day index for `now` in the viewer's timezone offset. */
export function localDayIndex(now: number, tzOffsetMinutes: number): number {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  return Math.floor((now - offsetMs) / DAY_MS);
}

export function remainingIntroduces(args: {
  addsOnDay: number;
  addDayKey: number | undefined;
  todayKey: number;
}): number {
  const usedToday = args.addDayKey === args.todayKey ? args.addsOnDay : 0;
  return Math.max(0, PASSAGE_MAX_ADDS_PER_DAY - usedToday);
}

/** Lowest index with attachment !== "solid"; or `pieces.length` if all solid. */
export function frontierIndex(pieces: readonly PassagePiece[]): number {
  const index = pieces.findIndex((piece) => piece.attachment !== "solid");
  return index === -1 ? pieces.length : index;
}

/** Indexes where attachment is attached | solid, ascending. */
export function ropePieceIndexes(pieces: readonly PassagePiece[]): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (piece && isRopeAttachment(piece.attachment)) indexes.push(index);
  }
  return indexes;
}

/**
 * Last {@link PASSAGE_CONNECT_EVERY_N} rope pieces when the rope length is a
 * positive multiple of that size; otherwise null (no connect yet).
 */
export function connectPairIndexes(
  pieces: readonly PassagePiece[],
): number[] | null {
  const rope = ropePieceIndexes(pieces);
  if (
    rope.length < PASSAGE_CONNECT_EVERY_N ||
    rope.length % PASSAGE_CONNECT_EVERY_N !== 0
  ) {
    return null;
  }
  return rope.slice(-PASSAGE_CONNECT_EVERY_N);
}

export function sectionStartIndex(
  pieces: readonly PassagePieceBase[],
  pieceIndex: number,
): number {
  const target = pieces[pieceIndex];
  if (!target) return 0;
  for (let index = 0; index <= pieceIndex; index += 1) {
    if (pieces[index]?.sectionIndex === target.sectionIndex) return index;
  }
  return pieceIndex;
}

/**
 * Default rope warm-up start. Rope only. If no attached/solid pieces, return 0
 * (caller skips rope). Caps at {@link PASSAGE_REHEARSAL_MAX_PIECES} then trims
 * oldest pieces while the window exceeds {@link PASSAGE_REHEARSAL_MAX_WORDS}.
 * Explicit section/passage start (UI) bypasses these caps.
 */
export function rehearsalStartIndex(
  pieces: readonly PassagePiece[],
  pieceWordCounts?: readonly number[],
): number {
  const rope = ropePieceIndexes(pieces);
  if (rope.length === 0) return 0;

  const target = rope[rope.length - 1];
  if (target === undefined) return 0;
  const end = target + 1;
  let start = Math.max(
    sectionStartIndex(pieces, target),
    end - PASSAGE_REHEARSAL_MAX_PIECES,
  );

  if (!pieceWordCounts) return start;

  const ropeWordSum = (from: number): number => {
    let sum = 0;
    for (let index = from; index < end; index += 1) {
      const piece = pieces[index];
      if (!piece || !isRopeAttachment(piece.attachment)) continue;
      sum += pieceWordCounts[index] ?? 0;
    }
    return sum;
  };

  while (start < target && ropeWordSum(start) > PASSAGE_REHEARSAL_MAX_WORDS) {
    start += 1;
  }

  return start;
}

/**
 * Concatenate per-piece masks for a rehearsal window `[start, end)`.
 * Solid → blank (density 0). Attached uses `learnStage`. Learning / unreached
 * are skipped (they should not appear in the window).
 */
export function compositeHintForWindow(
  pieces: readonly PassagePiece[],
  start: number,
  end: number,
  texts: readonly string[],
): string {
  const parts: string[] = [];
  const windowAligned =
    texts.length !== pieces.length && texts.length === Math.max(0, end - start);

  for (let index = start; index < end && index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece) continue;
    if (piece.attachment === "learning" || piece.attachment === "unreached") {
      continue;
    }

    const text = windowAligned
      ? (texts[index - start] ?? "")
      : (texts[index] ?? "");
    if (text.length === 0) continue;

    if (piece.attachment === "solid") {
      parts.push(
        maskVerseText(text, "hidden")
          .map((token) => token.text)
          .join(""),
      );
      continue;
    }

    const wordCount = countVerseWords(text);
    const hint = hintForProgress(piece.learnStage, piece.stageReps, wordCount);
    parts.push(
      maskVerseText(text, hint.stage, {
        density: hint.density,
        seed: hint.seed,
      })
        .map((token) => token.text)
        .join(""),
    );
  }

  return parts.join(" ");
}

/**
 * Infer attachment / stages from covering hearts at migration.
 * Review/mastered coverage → solid. Learning-phase coverage maps Guided-cleared
 * (stage ≥ 2) to attached. Isolated later solids are allowed; the frontier is
 * still the first non-solid.
 */
export function inferPieceLearningState(
  pieces: readonly PassagePieceBase[],
  hearts: readonly HeartedMemorySpan[],
): Array<Pick<PassagePiece, "attachment" | "learnStage" | "stageReps">> {
  const reviewHearts = hearts.filter((heart) => isReviewPhase(heart.status));
  const learningHearts = hearts.filter((heart) =>
    isLearningPhase(heart.status),
  );

  return pieces.map((piece) => {
    if (versesFullyCovered(piece, reviewHearts)) {
      return {
        attachment: "solid" as const,
        learnStage: MAX_LEARN_STAGE,
        stageReps: 0,
      };
    }
    if (!versesFullyCovered(piece, learningHearts)) {
      return { attachment: "unreached" as const, learnStage: 0, stageReps: 0 };
    }

    const covering = overlappingSpans(pieceSpan(piece), learningHearts);
    let learnStage = MAX_LEARN_STAGE;
    for (const heart of covering) {
      const stage = heart.learnStage ?? 0;
      if (stage < learnStage) learnStage = stage;
    }
    if (covering.length === 0) learnStage = 0;

    let stageReps = 0;
    let foundReps = false;
    for (const heart of covering) {
      if ((heart.learnStage ?? 0) !== learnStage) continue;
      const reps = heart.stageReps ?? 0;
      if (!foundReps || reps < stageReps) {
        stageReps = reps;
        foundReps = true;
      }
    }

    return {
      attachment:
        learnStage >= 2 ? ("attached" as const) : ("learning" as const),
      learnStage,
      stageReps,
    };
  });
}

/**
 * True when hearts look like an auto-heart of these canonical pieces: full
 * scope coverage and a 1:1 span bijection with the piece list.
 */
export function looksLikeAutoHeartedPassage(
  pieces: readonly PassagePieceBase[],
  hearts: readonly VerseSpan[],
  scope: VerseScope,
): boolean {
  if (pieces.length === 0 || hearts.length !== pieces.length) return false;
  if (!scopeCoverageComplete(scope, hearts)) return false;
  return matchingAutoHeartSpans(pieces, hearts).length === pieces.length;
}

/** Hearts whose span exactly matches a canonical piece. */
export function matchingAutoHeartSpans(
  pieces: readonly PassagePieceBase[],
  hearts: readonly VerseSpan[],
): VerseSpan[] {
  const matched: VerseSpan[] = [];
  for (const piece of pieces) {
    const hit = exactSpanMatch(pieceSpan(piece), hearts);
    if (hit) matched.push(hit);
  }
  return matched;
}

export function isPassagePieceLocked(
  piece: PassagePiece,
  now: number,
): boolean {
  if (piece.attachment !== "learning" && piece.attachment !== "attached") {
    return false;
  }
  if (piece.dueAt === undefined) return false;
  return isLearningLocked({ status: "learning", dueAt: piece.dueAt }, now);
}

/**
 * Lowest learning/attached piece that is not soft-locked. Skips a locked
 * attached frontier so a same-day introduce can still be drilled.
 */
export function dueFrontierIndex(
  pieces: readonly PassagePiece[],
  now: number,
): number | null {
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece) continue;
    if (piece.attachment !== "learning" && piece.attachment !== "attached") {
      continue;
    }
    if (!isPassagePieceLocked(piece, now)) return index;
  }
  return null;
}

/**
 * Bank a frontier attempt on one piece. Accuracy ≥ {@link PASSAGE_PASS_ACCURACY}
 * banks a rep (including From Memory — exact is not required). Clearing Guided
 * attaches; clearing From Memory solids; Guided/Challenge clears soft-lock.
 */
export function progressPassagePiece(
  piece: PassagePiece,
  input: {
    accuracy: number;
    now: number;
    tzOffsetMinutes: number;
    wordCount: number;
  },
): PassagePiece {
  if (input.accuracy < PASSAGE_PASS_ACCURACY) return piece;
  if (piece.attachment === "unreached" || piece.attachment === "solid") {
    return piece;
  }

  const required = requiredRepsFor(piece.learnStage, input.wordCount);
  const reps = piece.stageReps + 1;
  if (reps < required) {
    const dueAt =
      piece.dueAt === undefined ? input.now : Math.min(piece.dueAt, input.now);
    return { ...piece, stageReps: reps, dueAt };
  }

  if (piece.learnStage >= MAX_LEARN_STAGE) {
    return {
      ...piece,
      attachment: "solid",
      learnStage: MAX_LEARN_STAGE,
      stageReps: 0,
      dueAt: dueAtInCalendarDays(input.now, 1, input.tzOffsetMinutes),
    };
  }

  const sessionEnding = isLearningSessionEndingStage(piece.learnStage);
  const nextStage = piece.learnStage + 1;
  const attachment: PieceAttachment =
    nextStage >= 2 || piece.attachment === "attached" ? "attached" : "learning";
  const dueAt = sessionEnding
    ? dueAtInCalendarDays(input.now, 1, input.tzOffsetMinutes)
    : piece.dueAt === undefined
      ? input.now
      : Math.min(piece.dueAt, input.now);

  return {
    ...piece,
    attachment,
    learnStage: nextStage,
    stageReps: 0,
    dueAt,
  };
}
