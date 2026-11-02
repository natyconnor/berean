/**
 * A due Memorized verse's first unhinted miss, before Continue or a finished
 * refresher. Holding writes none of the counted try: no schedule, heatmap,
 * streak, or summary. Apply and replace are keyed by held id so every leave
 * path converges to one counted try.
 */

/** Next-load is the primary fallback. This only catches a held try that never loaded again. */
export const HELD_ATTEMPT_BACKSTOP_MS = 24 * 60 * 60 * 1000;

export type HeldTryId = string;

export type HeldTryQuality = "exact" | "close" | "off";

export type HeldTry = {
  id: HeldTryId;
  verseKey: string;
  accuracy: number;
  quality: HeldTryQuality;
  answer: string;
  attemptedAt: number;
};

export type CountedTry = {
  verseKey: string;
  accuracy: number;
  quality: HeldTryQuality;
  createdAt: number;
  refresherUsed: boolean;
};

export type HeldAttemptState = {
  heldById: ReadonlyMap<HeldTryId, HeldTry>;
  heldIdByVerse: ReadonlyMap<string, HeldTryId>;
  counted: readonly CountedTry[];
};

export function emptyHeldAttemptState(): HeldAttemptState {
  return {
    heldById: new Map(),
    heldIdByVerse: new Map(),
    counted: [],
  };
}

function cloneMaps(state: HeldAttemptState): {
  heldById: Map<HeldTryId, HeldTry>;
  heldIdByVerse: Map<string, HeldTryId>;
} {
  return {
    heldById: new Map(state.heldById),
    heldIdByVerse: new Map(state.heldIdByVerse),
  };
}

function dropHeld(
  heldById: Map<HeldTryId, HeldTry>,
  heldIdByVerse: Map<string, HeldTryId>,
  held: HeldTry,
): void {
  heldById.delete(held.id);
  if (heldIdByVerse.get(held.verseKey) === held.id) {
    heldIdByVerse.delete(held.verseKey);
  }
}

/** At most one held try per verse. A second hold replaces the first unread. */
export function holdFirstTry(
  state: HeldAttemptState,
  held: HeldTry,
): HeldAttemptState {
  const { heldById, heldIdByVerse } = cloneMaps(state);
  const previousId = heldIdByVerse.get(held.verseKey);
  if (previousId) {
    const previous = heldById.get(previousId);
    if (previous) dropHeld(heldById, heldIdByVerse, previous);
  }
  heldById.set(held.id, held);
  heldIdByVerse.set(held.verseKey, held.id);
  return { heldById, heldIdByVerse, counted: state.counted };
}

/**
 * Apply the held miss as the counted try, dated to its original attemptedAt.
 * A missing id is a no-op, so Continue, leave, pagehide, the fallback, and
 * the backstop can all call this.
 */
export function applyHeldTry(
  state: HeldAttemptState,
  heldId: HeldTryId,
): { state: HeldAttemptState; applied: HeldTry | null } {
  const held = state.heldById.get(heldId) ?? null;
  if (!held) return { state, applied: null };
  const { heldById, heldIdByVerse } = cloneMaps(state);
  dropHeld(heldById, heldIdByVerse, held);
  const counted: CountedTry = {
    verseKey: held.verseKey,
    accuracy: held.accuracy,
    quality: held.quality,
    createdAt: held.attemptedAt,
    refresherUsed: false,
  };
  return {
    state: {
      heldById,
      heldIdByVerse,
      counted: [...state.counted, counted],
    },
    applied: held,
  };
}

/**
 * Drop the held try and record step 2 as the counted try, unless a counted
 * try already exists today. Then step 2 is practice only.
 */
export function replaceHeldTry(
  state: HeldAttemptState,
  heldId: HeldTryId,
  step2: Omit<CountedTry, "refresherUsed">,
  dayStart: number,
): {
  state: HeldAttemptState;
  replaced: HeldTry | null;
  practiceOnly: boolean;
} {
  const held = state.heldById.get(heldId) ?? null;
  const { heldById, heldIdByVerse } = cloneMaps(state);
  if (held) dropHeld(heldById, heldIdByVerse, held);
  const withoutHeld: HeldAttemptState = {
    heldById,
    heldIdByVerse,
    counted: state.counted,
  };
  const practiceOnly = countedTryExistsToday(
    withoutHeld,
    step2.verseKey,
    dayStart,
  );
  if (practiceOnly) {
    return { state: withoutHeld, replaced: held, practiceOnly: true };
  }
  return {
    state: {
      ...withoutHeld,
      counted: [
        ...withoutHeld.counted,
        {
          verseKey: step2.verseKey,
          accuracy: step2.accuracy,
          quality: step2.quality,
          createdAt: step2.createdAt,
          refresherUsed: true,
        },
      ],
    },
    replaced: held,
    practiceOnly: false,
  };
}

export function countedTryExistsToday(
  state: HeldAttemptState,
  verseKey: string,
  dayStart: number,
): boolean {
  return state.counted.some(
    (row) => row.verseKey === verseKey && row.createdAt >= dayStart,
  );
}

/** A first unhinted miss on a due Memorized verse, before any counted try today. */
export function isHoldableColdMiss(args: {
  reviewPhase: boolean;
  due: boolean;
  accuracy: number;
  passAccuracy: number;
  refresherOpen: boolean;
  countedToday: boolean;
}): boolean {
  return (
    args.reviewPhase &&
    args.due &&
    !args.refresherOpen &&
    !args.countedToday &&
    args.accuracy < args.passAccuracy
  );
}
