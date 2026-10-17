import { useCanGoBack, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { parseMemoryReturn } from "@/lib/memory-return";

const MEMORY_HOME = "/memory";

export type MemoryExitTarget =
  | { kind: "return"; href: string }
  | { kind: "history" }
  | { kind: "fallback"; href: string };

/**
 * Where a session goes when it ends: its `return` (exactly where it started,
 * open drawer included), else the previous screen, else `fallbackHref`.
 */
export function memoryExitTarget(
  returnTo: string | undefined,
  canGoBack: boolean,
  fallbackHref: string = MEMORY_HOME,
): MemoryExitTarget {
  const href = parseMemoryReturn(returnTo);
  if (href !== undefined) return { kind: "return", href };
  if (canGoBack) return { kind: "history" };
  return { kind: "fallback", href: fallbackHref };
}

/** The session back link: "Back to Today" when it lands on Today, else "Back". */
export function memoryExitLabel(target: MemoryExitTarget): string {
  return target.kind !== "history" && target.href === MEMORY_HOME
    ? "Back to Today"
    : "Back";
}

/**
 * Leave a memory session for the screen that opened it. Sessions are shared
 * routes opened from Today, drawers, pages, and the reader, so each carries
 * a `return`. The session's history entry is replaced so Back from there does
 * not reopen a finished session.
 */
export function useMemoryExit(
  returnTo?: string,
  fallbackHref: string = MEMORY_HOME,
): () => void {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return useCallback(() => {
    const target = memoryExitTarget(returnTo, canGoBack, fallbackHref);
    if (target.kind === "history") {
      window.history.back();
      return;
    }
    void navigate({ href: target.href, replace: true });
  }, [canGoBack, fallbackHref, navigate, returnTo]);
}

/** Label for {@link useMemoryExit}'s destination. */
export function useMemoryExitLabel(
  returnTo?: string,
  fallbackHref: string = MEMORY_HOME,
): string {
  const canGoBack = useCanGoBack();
  return memoryExitLabel(memoryExitTarget(returnTo, canGoBack, fallbackHref));
}
