import { useEffect, useEffectEvent } from "react";

/**
 * Calls `close` when browser Back or Forward fires `popstate` while `open`.
 * In-app navigations use `pushState`, which never fires `popstate`.
 */
export function useCloseOnHistoryNavigation(open: boolean, close: () => void) {
  const onPopState = useEffectEvent(close);

  useEffect(() => {
    if (!open) return;
    const handlePopState = () => onPopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open]);
}
