import { useEffect, useState } from "react";

const DEFAULT_INTERVAL_MS = 300_000;

/**
 * A coarse "current time" that refreshes on an interval so time-dependent
 * reactive queries (e.g. due counts) stay live while a tab is left open.
 *
 * The value updates at most once per `intervalMs` (default 5 minutes) rather than
 * every second, so it won't thrash re-renders. Pass the returned value as a
 * Convex query arg — never call `Date.now()` inside a Convex query.
 */
export function useLiveNow(intervalMs: number = DEFAULT_INTERVAL_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
