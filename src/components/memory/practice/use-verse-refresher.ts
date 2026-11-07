import { useCallback, useState } from "react";

export type VerseRefresherPhase = "off" | "step1" | "step2";
export type VerseRefresherKind = "pre-try" | "after-miss" | "practice";

type VerseRefresherState =
  { phase: "off" } | { phase: "step1" | "step2"; kind: VerseRefresherKind };

/**
 * Refresher sitting on one verse card. Kind is only present while open, so a
 * leave-counts line cannot leak onto a pre-try or practice round. With
 * `openAs`, it starts open at step 1 (••• Refresh).
 */
export function useVerseRefresher(openAs?: VerseRefresherKind) {
  const [state, setState] = useState<VerseRefresherState>(() =>
    openAs ? { phase: "step1", kind: openAs } : { phase: "off" },
  );

  const open = useCallback((kind: VerseRefresherKind = "pre-try") => {
    setState({ phase: "step1", kind });
  }, []);

  const continueToStep2 = useCallback(() => {
    setState((current) =>
      current.phase === "off" ? current : { ...current, phase: "step2" },
    );
  }, []);

  const close = useCallback(() => {
    setState({ phase: "off" });
  }, []);

  const step: 1 | 2 | null =
    state.phase === "off" ? null : state.phase === "step1" ? 1 : 2;

  return {
    phase: state.phase,
    kind: state.phase === "off" ? null : state.kind,
    isOpen: state.phase !== "off",
    step,
    open,
    continueToStep2,
    close,
  };
}
