import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";

import { devLog } from "@/lib/dev-log";

import { api } from "../../convex/_generated/api";

let inFlight: Promise<void> | null = null;

/**
 * Apply leftover held first-try misses once per sign-in, and tell session
 * loaders when that write has settled. `dueQueue` and pack members freeze
 * their first snapshot; reading them before this mutation would keep a verse
 * that is no longer due.
 */
export function useLeftoverHeldAttemptsReady(): boolean {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const applyLeftoverHeldAttempts = useMutation(
    api.verseMemory.applyLeftoverHeldAttempts,
  );
  const [applied, setApplied] = useState(false);
  const [seenAuth, setSeenAuth] = useState(isAuthenticated);
  if (seenAuth !== isAuthenticated) {
    setSeenAuth(isAuthenticated);
    setApplied(false);
  }

  useEffect(() => {
    if (!isAuthenticated) {
      inFlight = null;
      return;
    }

    let cancelled = false;
    if (!inFlight) {
      inFlight = applyLeftoverHeldAttempts({})
        .then(() => undefined)
        .catch((error: unknown) => {
          inFlight = null;
          devLog.warn("verseMemory", "applyLeftoverHeldAttempts failed", error);
        });
    }
    void inFlight.then(() => {
      if (!cancelled) setApplied(true);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLeftoverHeldAttempts, isAuthenticated]);

  if (!isAuthenticated) return !isLoading;
  return applied;
}

/** Fire-and-forget for surfaces that do not freeze a due queue. */
export function useApplyLeftoverHeldAttempts(): void {
  useLeftoverHeldAttemptsReady();
}

/** Test-only: forget that this session already asked to apply leftovers. */
export function resetApplyLeftoverHeldAttemptsForTests(): void {
  inFlight = null;
}
