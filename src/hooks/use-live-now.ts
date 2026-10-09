import { useSyncExternalStore } from "react";

import { DAY_MS, MIN_LEARNING_LOCK_MS } from "@/lib/memory-scheduler";

/**
 * One frozen "now" for the JS session. Dock badge, dashboard, and memory
 * queues share it so they cannot drift during a sitting. Counts still update
 * when a review or learn attempt patches `verseMemory` (same query args,
 * reactive data).
 *
 * The clock does catch up without a reload when the local calendar day
 * changes, or when a 6-hour learning lock could have expired — otherwise a
 * verse started yesterday stays on a disabled Learn / "Tomorrow" CTA until
 * the tab is fully reloaded.
 */
let sessionNow: number | undefined;
const sessionNowListeners = new Set<() => void>();

let watchesAttached = false;
let catchUpTimer: number | undefined;

function localDayKey(timestamp: number, tzOffsetMinutes: number): number {
  return Math.floor((timestamp - tzOffsetMinutes * 60 * 1000) / DAY_MS);
}

function nextLocalMidnightUtc(
  timestamp: number,
  tzOffsetMinutes: number,
): number {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const startOfLocalDay = Math.floor((timestamp - offsetMs) / DAY_MS) * DAY_MS;
  return startOfLocalDay + DAY_MS + offsetMs;
}

/**
 * Whether the frozen session clock should sample `Date.now()` again.
 *
 * A new local day must catch up so yesterday's Guided/Challenge lock can
 * expire. Same-day catch-up waits for {@link MIN_LEARNING_LOCK_MS} so a
 * late-night 6-hour floor (due at 5am) unlocks after midnight without a
 * reload, while a 10-minute tab switch does not churn query args.
 */
export function shouldAdvanceSessionNow(
  frozenNow: number,
  currentNow: number,
  tzOffsetMinutes: number,
): boolean {
  if (currentNow <= frozenNow) return false;
  if (
    localDayKey(currentNow, tzOffsetMinutes) !==
    localDayKey(frozenNow, tzOffsetMinutes)
  ) {
    return true;
  }
  return currentNow - frozenNow >= MIN_LEARNING_LOCK_MS;
}

export function getSessionNow(): number {
  sessionNow ??= Date.now();
  return sessionNow;
}

function notifySessionNowListeners(): void {
  for (const listener of sessionNowListeners) listener();
}

function maybeAdvanceSessionNow(): boolean {
  const current = Date.now();
  const tzOffsetMinutes = new Date(current).getTimezoneOffset();
  if (sessionNow === undefined) {
    sessionNow = current;
    return false;
  }
  if (!shouldAdvanceSessionNow(sessionNow, current, tzOffsetMinutes)) {
    return false;
  }
  sessionNow = current;
  notifySessionNowListeners();
  return true;
}

function clearCatchUpTimer(): void {
  if (catchUpTimer === undefined) return;
  window.clearTimeout(catchUpTimer);
  catchUpTimer = undefined;
}

function scheduleCatchUpTimer(): void {
  if (typeof window === "undefined") return;
  clearCatchUpTimer();
  const current = Date.now();
  const frozen = getSessionNow();
  const tzOffsetMinutes = new Date(current).getTimezoneOffset();
  const untilMidnight = nextLocalMidnightUtc(frozen, tzOffsetMinutes) - current;
  const untilLockFloor = frozen + MIN_LEARNING_LOCK_MS - current;
  const delay = Math.min(
    ...[untilMidnight, untilLockFloor].filter((value) => value > 0),
  );
  if (!Number.isFinite(delay)) return;
  catchUpTimer = window.setTimeout(() => {
    maybeAdvanceSessionNow();
    scheduleCatchUpTimer();
  }, delay);
}

function handleVisibilityOrFocus(): void {
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden"
  ) {
    return;
  }
  maybeAdvanceSessionNow();
  scheduleCatchUpTimer();
}

function ensureSessionClockWatches(): void {
  if (watchesAttached || typeof window === "undefined") return;
  watchesAttached = true;
  document.addEventListener("visibilitychange", handleVisibilityOrFocus);
  window.addEventListener("focus", handleVisibilityOrFocus);
  window.addEventListener("pageshow", handleVisibilityOrFocus);
  scheduleCatchUpTimer();
}

function teardownSessionClockWatches(): void {
  if (!watchesAttached || typeof window === "undefined") return;
  watchesAttached = false;
  document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
  window.removeEventListener("focus", handleVisibilityOrFocus);
  window.removeEventListener("pageshow", handleVisibilityOrFocus);
  clearCatchUpTimer();
}

function subscribeSessionNow(onStoreChange: () => void): () => void {
  ensureSessionClockWatches();
  sessionNowListeners.add(onStoreChange);
  maybeAdvanceSessionNow();
  return () => {
    sessionNowListeners.delete(onStoreChange);
    if (sessionNowListeners.size === 0) {
      teardownSessionClockWatches();
    }
  };
}

export function useLiveNow(): number {
  return useSyncExternalStore(
    subscribeSessionNow,
    getSessionNow,
    getSessionNow,
  );
}

/** Test-only: drop the frozen clock so the next read samples `Date.now()`. */
export function resetSessionNowForTests(): void {
  sessionNow = undefined;
  teardownSessionClockWatches();
  sessionNowListeners.clear();
}
