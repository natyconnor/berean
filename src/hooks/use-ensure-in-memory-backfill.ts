import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";

import { devLog } from "@/lib/dev-log";

import { api } from "../../convex/_generated/api";

let requested = false;

/**
 * Ask the server once per sign-in to derive `verseMemory.inMemory` for the
 * signed-in user. Signing out resets it, so the next account gets its own
 * call. The mutation no-ops once the user is stamped, so a failed call is
 * simply retried on the next mount.
 */
export function useEnsureInMemoryBackfill(now: number): void {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureInMemoryBackfill = useMutation(
    api.verseMemory.ensureInMemoryBackfill,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      if (!isLoading) requested = false;
      return;
    }
    if (requested) return;
    requested = true;
    ensureInMemoryBackfill({ now }).catch((error: unknown) => {
      requested = false;
      devLog.warn("verseMemory", "ensureInMemoryBackfill failed", error);
    });
  }, [ensureInMemoryBackfill, isAuthenticated, isLoading, now]);
}

/** Test-only: forget that this session already asked for the backfill. */
export function resetEnsureInMemoryBackfillForTests(): void {
  requested = false;
}
