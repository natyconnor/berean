import type { DiffToken } from "./diff-words";
import {
  dueFrontierIndex,
  frontierIndex,
  isPassagePieceLocked,
  localDayIndex,
  PASSAGE_PASS_ACCURACY,
  progressPassagePiece,
  remainingIntroduces,
  rehearsalStartIndex,
  ropePieceIndexes,
} from "./passage-frontier";
import type { PassagePiece } from "./passage-pieces";
import { repairStartIndex, stallPieceIndex } from "./passage-stall";

export type PassageSessionPhase =
  | "rope"
  | "stall-repair"
  | "frontier"
  | "offer-introduce"
  | "section-complete"
  | "passage-complete"
  | "budget-exhausted"
  | "frontier-locked";

export type PassagePendingMutation =
  | { name: "introduceNext" }
  | {
      name: "recordAttempt";
      kind: "rope" | "repair" | "frontier" | "review";
      accuracy: number;
      pieceIndex?: number;
    };

export type PassageSessionState = {
  phase: PassageSessionPhase;
  pieces: readonly PassagePiece[];
  addsOnDay: number;
  addDayKey?: number;
  now: number;
  tzOffsetMinutes: number;
  pieceWordCounts?: readonly number[];
  /** Phase to resume after a stall-repair pass. */
  interruptedPhase?: PassageSessionPhase;
  /** 0-based index into {@link PassageSessionState.rehearsalRopeIndexes}. */
  stallIndex?: number;
  rehearsalStart?: number;
  /** Rope indexes of the prompt just attempted (full window, then repair slice). */
  rehearsalRopeIndexes?: readonly number[];
  pendingMutation?: PassagePendingMutation;
};

export type PassageSessionEvent =
  | { type: "introduce"; now?: number }
  | {
      type: "attempt";
      accuracy: number;
      now?: number;
      tokens?: readonly DiffToken[];
    }
  | { type: "continue"; now?: number };

function eventNow(
  state: PassageSessionState,
  event: PassageSessionEvent,
): number {
  return event.now ?? state.now;
}

function remainingIn(state: PassageSessionState, now: number): number {
  return remainingIntroduces({
    addsOnDay: state.addsOnDay,
    addDayKey: state.addDayKey,
    todayKey: localDayIndex(now, state.tzOffsetMinutes),
  });
}

function hasUnreached(pieces: readonly PassagePiece[]): boolean {
  return pieces.some((piece) => piece.attachment === "unreached");
}

function allSolid(pieces: readonly PassagePiece[]): boolean {
  return (
    pieces.length > 0 && pieces.every((piece) => piece.attachment === "solid")
  );
}

function wordCountAt(state: PassageSessionState, index: number): number {
  return state.pieceWordCounts?.[index] ?? 10;
}

function sectionAllSolid(
  pieces: readonly PassagePiece[],
  sectionIndex: number,
): boolean {
  const inSection = pieces.filter(
    (piece) => piece.sectionIndex === sectionIndex,
  );
  return (
    inSection.length > 0 &&
    inSection.every((piece) => piece.attachment === "solid")
  );
}

function phaseAfterWarmup(
  pieces: readonly PassagePiece[],
  remaining: number,
  now: number,
): PassageSessionPhase {
  if (allSolid(pieces)) return "passage-complete";
  if (dueFrontierIndex(pieces, now) !== null) return "frontier";
  if (remaining > 0 && hasUnreached(pieces)) return "offer-introduce";
  const frontier = pieces[frontierIndex(pieces)];
  if (frontier && isPassagePieceLocked(frontier, now)) return "frontier-locked";
  if (hasUnreached(pieces)) return "budget-exhausted";
  return "frontier-locked";
}

function ropeWindow(state: PassageSessionState): {
  start: number;
  end: number;
  ropeIndexes: number[];
} {
  const rope = ropePieceIndexes(state.pieces);
  if (rope.length === 0) {
    return { start: 0, end: 0, ropeIndexes: [] };
  }
  const last = rope[rope.length - 1] ?? 0;
  const start = rehearsalStartIndex(state.pieces, state.pieceWordCounts);
  const ropeIndexes: number[] = [];
  for (let index = start; index <= last; index += 1) {
    const piece = state.pieces[index];
    if (
      piece &&
      (piece.attachment === "attached" || piece.attachment === "solid")
    ) {
      ropeIndexes.push(index);
    }
  }
  return { start, end: last + 1, ropeIndexes };
}

function promptRopeIndexes(
  state: PassageSessionState,
  windowRope: readonly number[],
  kind: "rope" | "repair",
): number[] {
  if (kind !== "repair") return [...windowRope];
  const current =
    state.rehearsalRopeIndexes && state.rehearsalRopeIndexes.length > 0
      ? state.rehearsalRopeIndexes
      : windowRope;
  const repairStart = repairWindowStart(state);
  const from = current.findIndex((index) => index === repairStart);
  const slice =
    from >= 0
      ? current.slice(from)
      : current.filter((index) => index > repairStart);
  if (slice.length > 0) return [...slice];
  return current.length > 0 ? [...current] : [...windowRope];
}

function replacePiece(
  pieces: readonly PassagePiece[],
  index: number,
  next: PassagePiece,
): PassagePiece[] {
  return pieces.map((piece, pieceIndex) =>
    pieceIndex === index ? next : piece,
  );
}

function clearSignals(
  state: PassageSessionState,
  now: number,
): PassageSessionState {
  return {
    ...state,
    now,
    pendingMutation: undefined,
    stallIndex: undefined,
    interruptedPhase: undefined,
    rehearsalRopeIndexes: undefined,
  };
}

/**
 * Opening phase for a passage session.
 * All solid → passage-complete. Any attached/solid → rope warm-up.
 * Else frontier if due; introduce if only unreached and budget remains;
 * frontier-locked when the frontier is soft-locked, the rope is empty, and
 * nothing can be introduced.
 */
export function initialPassageSessionPhase(args: {
  pieces: readonly PassagePiece[];
  remainingIntroduces: number;
  now: number;
}): PassageSessionPhase {
  const { pieces, remainingIntroduces: remaining, now } = args;
  if (allSolid(pieces)) return "passage-complete";

  const rope = ropePieceIndexes(pieces);
  if (rope.length > 0) return "rope";

  if (dueFrontierIndex(pieces, now) !== null) return "frontier";

  const frontier = pieces[frontierIndex(pieces)];
  const locked = Boolean(frontier && isPassagePieceLocked(frontier, now));
  const canAdd = remaining > 0 && hasUnreached(pieces);

  if (canAdd) return "offer-introduce";
  if (locked && rope.length === 0) return "frontier-locked";
  if (hasUnreached(pieces)) return "budget-exhausted";
  if (pieces.length === 0 && remaining > 0) return "offer-introduce";
  return "frontier-locked";
}

function introducePiece(
  state: PassageSessionState,
  now: number,
): PassageSessionState {
  const remaining = remainingIn(state, now);
  if (remaining <= 0) {
    return {
      ...clearSignals(state, now),
      phase: hasUnreached(state.pieces) ? "budget-exhausted" : state.phase,
    };
  }

  const nextIndex = state.pieces.findIndex(
    (piece) => piece.attachment === "unreached",
  );
  if (nextIndex === -1) {
    return { ...clearSignals(state, now), phase: state.phase };
  }

  const current = state.pieces[nextIndex];
  if (!current) return { ...clearSignals(state, now), phase: state.phase };

  const introduced: PassagePiece = {
    ...current,
    attachment: "learning",
    learnStage: 0,
    stageReps: 0,
    dueAt: now,
  };
  const pieces = replacePiece(state.pieces, nextIndex, introduced);
  const todayKey = localDayIndex(now, state.tzOffsetMinutes);
  const usedToday = state.addDayKey === todayKey ? state.addsOnDay : 0;

  return {
    ...state,
    now,
    pieces,
    addsOnDay: usedToday + 1,
    addDayKey: todayKey,
    phase: "frontier",
    pendingMutation: { name: "introduceNext" },
    stallIndex: undefined,
    interruptedPhase: undefined,
  };
}

function applyFrontierAttempt(
  state: PassageSessionState,
  accuracy: number,
  now: number,
): PassageSessionState {
  const dueIndex = dueFrontierIndex(state.pieces, now);
  if (dueIndex === null) {
    return {
      ...clearSignals(state, now),
      phase: phaseAfterWarmup(state.pieces, remainingIn(state, now), now),
    };
  }

  const piece = state.pieces[dueIndex];
  if (!piece) return { ...clearSignals(state, now), phase: state.phase };

  const nextPiece = progressPassagePiece(piece, {
    accuracy,
    now,
    tzOffsetMinutes: state.tzOffsetMinutes,
    wordCount: wordCountAt(state, dueIndex),
  });
  const pieces = replacePiece(state.pieces, dueIndex, nextPiece);
  const pendingMutation: PassagePendingMutation = {
    name: "recordAttempt",
    kind: "frontier",
    accuracy,
    pieceIndex: dueIndex,
  };

  if (accuracy < PASSAGE_PASS_ACCURACY) {
    return {
      ...state,
      now,
      pieces,
      phase: "frontier",
      pendingMutation,
      stallIndex: undefined,
      interruptedPhase: undefined,
    };
  }

  if (allSolid(pieces)) {
    return {
      ...state,
      now,
      pieces,
      phase: "passage-complete",
      pendingMutation,
      stallIndex: undefined,
      interruptedPhase: undefined,
    };
  }

  if (
    nextPiece.attachment === "solid" &&
    piece.attachment !== "solid" &&
    sectionAllSolid(pieces, nextPiece.sectionIndex)
  ) {
    return {
      ...state,
      now,
      pieces,
      phase: "section-complete",
      pendingMutation,
      stallIndex: undefined,
      interruptedPhase: undefined,
    };
  }

  const remaining = remainingIn(state, now);
  return {
    ...state,
    now,
    pieces,
    phase: phaseAfterWarmup(pieces, remaining, now),
    pendingMutation,
    stallIndex: undefined,
    interruptedPhase: undefined,
  };
}

function applyRopeAttempt(
  state: PassageSessionState,
  accuracy: number,
  now: number,
  tokens: readonly DiffToken[] | undefined,
  kind: "rope" | "repair",
): PassageSessionState {
  const window = ropeWindow(state);
  if (window.ropeIndexes.length === 0) {
    return {
      ...clearSignals(state, now),
      phase: phaseAfterWarmup(state.pieces, remainingIn(state, now), now),
    };
  }

  const pendingMutation: PassagePendingMutation = {
    name: "recordAttempt",
    kind,
    accuracy,
  };

  if (accuracy >= PASSAGE_PASS_ACCURACY) {
    const nextPhase =
      kind === "repair" && state.interruptedPhase
        ? state.interruptedPhase
        : phaseAfterWarmup(state.pieces, remainingIn(state, now), now);
    return {
      ...state,
      now,
      phase: nextPhase,
      pendingMutation,
      stallIndex: undefined,
      interruptedPhase: undefined,
      rehearsalStart: window.start,
      rehearsalRopeIndexes: window.ropeIndexes,
    };
  }

  const mappingIndexes = promptRopeIndexes(state, window.ropeIndexes, kind);
  const counts = mappingIndexes.map((index) => wordCountAt(state, index));
  const localStall = tokens ? stallPieceIndex(tokens, counts) : 0;
  const continuePhase = phaseAfterWarmup(
    state.pieces,
    remainingIn(state, now),
    now,
  );

  return {
    ...state,
    now,
    phase: "stall-repair",
    pendingMutation,
    stallIndex: localStall,
    rehearsalStart: window.start,
    rehearsalRopeIndexes: mappingIndexes,
    interruptedPhase: state.interruptedPhase ?? continuePhase,
  };
}

/**
 * Pure phase machine. Attachment flips live on the returned pieces so the UI
 * can persist them via `introduceNext` / `recordAttempt` when
 * `pendingMutation` is set.
 */
export function reducePassageSession(
  state: PassageSessionState,
  event: PassageSessionEvent,
): PassageSessionState {
  const now = eventNow(state, event);

  if (state.phase === "passage-complete" && event.type !== "attempt") {
    return { ...clearSignals(state, now), phase: "passage-complete" };
  }

  if (event.type === "introduce") {
    if (state.phase === "stall-repair") {
      return { ...state, now, pendingMutation: undefined };
    }
    return introducePiece(state, now);
  }

  if (event.type === "continue") {
    const remaining = remainingIn(state, now);
    return {
      ...clearSignals(state, now),
      phase: phaseAfterWarmup(state.pieces, remaining, now),
    };
  }

  const accuracy = event.accuracy;
  const tokens = event.tokens;

  if (state.phase === "stall-repair") {
    return applyRopeAttempt(state, accuracy, now, tokens, "repair");
  }

  if (state.phase === "frontier") {
    return applyFrontierAttempt(state, accuracy, now);
  }

  if (state.phase === "section-complete") {
    if (accuracy >= PASSAGE_PASS_ACCURACY) {
      return {
        ...clearSignals(state, now),
        phase: phaseAfterWarmup(state.pieces, remainingIn(state, now), now),
        pendingMutation: {
          name: "recordAttempt",
          kind: "rope",
          accuracy,
        },
      };
    }
    return applyRopeAttempt(state, accuracy, now, tokens, "rope");
  }

  if (
    state.phase === "rope" ||
    state.phase === "frontier-locked" ||
    state.phase === "budget-exhausted" ||
    state.phase === "offer-introduce" ||
    state.phase === "passage-complete"
  ) {
    if (
      ropePieceIndexes(state.pieces).length === 0 &&
      state.phase !== "passage-complete"
    ) {
      return { ...clearSignals(state, now), phase: state.phase };
    }
    const kind = state.phase === "passage-complete" ? "review" : "rope";
    if (kind === "review") {
      const pendingMutation: PassagePendingMutation = {
        name: "recordAttempt",
        kind: "review",
        accuracy,
      };
      return { ...state, now, pendingMutation };
    }
    return applyRopeAttempt(state, accuracy, now, tokens, "rope");
  }

  return { ...state, now, pendingMutation: undefined };
}

/** True when a sixth introduce would exceed {@link PASSAGE_MAX_ADDS_PER_DAY}. */
export function introduceWouldExceedBudget(
  state: PassageSessionState,
  now: number = state.now,
): boolean {
  return remainingIn(state, now) <= 0;
}

export function repairWindowStart(state: PassageSessionState): number {
  const ropeIndexes =
    state.rehearsalRopeIndexes ?? ropeWindow(state).ropeIndexes;
  return repairStartIndex(ropeIndexes, state.stallIndex ?? 0);
}
