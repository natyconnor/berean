import { useState } from "react";

/**
 * One frozen "now" for the JS session. Dock badge, dashboard, and memory
 * queues share it so they cannot drift. Counts still update when a review or
 * learn attempt patches `verseMemory` (same query args, reactive data).
 *
 * Verses that become due later while the tab sits idle wait for a reload.
 */
let sessionNow: number | undefined;

export function getSessionNow(): number {
  sessionNow ??= Date.now();
  return sessionNow;
}

export function useLiveNow(): number {
  const [now] = useState(getSessionNow);
  return now;
}
