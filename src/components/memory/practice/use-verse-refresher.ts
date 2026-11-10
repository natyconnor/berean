import { useCallback, useState } from "react";

import type { PassageVerseKey } from "@/lib/passage-shaky";

/**
 * `step1` is First letters on a random half of the words, `every-word` is
 * First letters on every word of the verses that step missed, and `step2` is
 * From memory.
 */
export type VerseRefresherPhase = "off" | "step1" | "every-word" | "step2";
export type VerseRefresherKind = "pre-try" | "after-miss" | "practice";

type VerseRefresherState =
  | { phase: "off" }
  | {
      phase: Exclude<VerseRefresherPhase, "off">;
      kind: VerseRefresherKind;
      /** Picks the half-hinted words; new each time the refresher opens. */
      seed: number;
      /** Verses under 85% on step 1, or null when no every-word step. */
      everyWord: readonly PassageVerseKey[] | null;
    };

const NO_VERSES: readonly PassageVerseKey[] = [];

function opened(
  kind: VerseRefresherKind,
  random: () => number,
): VerseRefresherState {
  return {
    phase: "step1",
    kind,
    seed: Math.floor(random() * 2 ** 32),
    everyWord: null,
  };
}

/**
 * Refresher sitting on one verse card. Kind is only present while open, so a
 * leave-counts line cannot leak onto a pre-try or practice round. With
 * `openAs`, it starts open at step 1 (••• Refresh).
 */
export function useVerseRefresher(
  openAs?: VerseRefresherKind,
  random: () => number = Math.random,
) {
  const [state, setState] = useState<VerseRefresherState>(() =>
    openAs ? opened(openAs, random) : { phase: "off" },
  );

  const open = useCallback(
    (kind: VerseRefresherKind = "pre-try") => {
      setState(opened(kind, random));
    },
    [random],
  );

  /**
   * Step 1 went under 85%: Continue leads to an every-word step on `verses`
   * (a passage's missed verses; a verse card passes none).
   */
  const needEveryWord = useCallback(
    (verses: readonly PassageVerseKey[] = []) => {
      setState((current) =>
        current.phase === "step1" ? { ...current, everyWord: verses } : current,
      );
    },
    [],
  );

  /** Step 1 to the every-word step when it is needed, else to From memory. */
  const continueToNext = useCallback(() => {
    setState((current) => {
      if (current.phase === "step1" && current.everyWord) {
        return { ...current, phase: "every-word" };
      }
      return current.phase === "off" ? current : { ...current, phase: "step2" };
    });
  }, []);

  const close = useCallback(() => {
    setState({ phase: "off" });
  }, []);

  const total: 2 | 3 = state.phase !== "off" && state.everyWord ? 3 : 2;
  const step: 1 | 2 | 3 | null =
    state.phase === "off"
      ? null
      : state.phase === "step1"
        ? 1
        : state.phase === "every-word"
          ? 2
          : total;

  return {
    phase: state.phase,
    kind: state.phase === "off" ? null : state.kind,
    isOpen: state.phase !== "off",
    /** Either First letters step: hinted, saves nothing. */
    firstLetters: state.phase === "step1" || state.phase === "every-word",
    seed: state.phase === "off" ? 0 : state.seed,
    everyWordVerses:
      state.phase === "off" ? NO_VERSES : (state.everyWord ?? NO_VERSES),
    step,
    total,
    open,
    needEveryWord,
    continueToNext,
    close,
  };
}
