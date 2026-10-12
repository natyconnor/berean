import { useCallback, useSyncExternalStore } from "react";

/** Below Tailwind's `sm` breakpoint, where sheets come up from the bottom. */
export const MOBILE_MEDIA_QUERY = "(max-width: 639.98px)";

function mediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query);
}

/**
 * Live `matchMedia(query).matches`. False on the server and wherever
 * `matchMedia` is missing, so the first paint assumes a wide viewport.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaQueryList(query);
      if (!list) return () => {};
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => mediaQueryList(query)?.matches ?? false,
    () => false,
  );
}

/** True below 640px. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
