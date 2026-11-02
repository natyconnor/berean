import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";

import { devLog } from "@/lib/dev-log";

import { api } from "../../convex/_generated/api";

let requested = false;

/**
 * Apply leftover held first-try misses once per sign-in. A closed tab or
 * reload counts the miss; this is the next session / dashboard load path.
 */
export function useApplyLeftoverHeldAttempts(): void {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const applyLeftoverHeldAttempts = useMutation(
    api.verseMemory.applyLeftoverHeldAttempts,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      if (!isLoading) requested = false;
      return;
    }
    if (requested) return;
    requested = true;
    applyLeftoverHeldAttempts({}).catch((error: unknown) => {
      requested = false;
      devLog.warn("verseMemory", "applyLeftoverHeldAttempts failed", error);
    });
  }, [applyLeftoverHeldAttempts, isAuthenticated, isLoading]);
}

/** Test-only: forget that this session already asked to apply leftovers. */
export function resetApplyLeftoverHeldAttemptsForTests(): void {
  requested = false;
}
