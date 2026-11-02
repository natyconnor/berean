import { useCallback, useState } from "react";

export type VerseRefresherPhase = "off" | "step1" | "step2";

/**
 * Pre-try refresher sitting on one verse card: off, First letters, then
 * From memory. Invalid combinations (both steps, skip) cannot be represented.
 */
export function useVerseRefresher() {
  const [phase, setPhase] = useState<VerseRefresherPhase>("off");

  const open = useCallback(() => {
    setPhase("step1");
  }, []);

  const continueToStep2 = useCallback(() => {
    setPhase("step2");
  }, []);

  const close = useCallback(() => {
    setPhase("off");
  }, []);

  const step: 1 | 2 | null = phase === "off" ? null : phase === "step1" ? 1 : 2;

  return {
    phase,
    isOpen: phase !== "off",
    step,
    open,
    continueToStep2,
    close,
  };
}
