import { useCanGoBack, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Leave a memory session for the screen that opened it.
 *
 * Verse sessions are shared routes (`/memory/learn`, `/memory/review`,
 * `/memory/practice`). They are opened from the dashboard, the library, and
 * from a pack, so a fixed jump to `/memory` drops a pack-started session on
 * the dashboard. History returns to that previous screen; a direct visit with
 * nowhere to go still lands on the Memory home.
 */
export function useMemoryBack(): () => void {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return useCallback(() => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/memory" });
  }, [canGoBack, navigate]);
}
