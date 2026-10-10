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
 * the tab is fully reloaded. A one-minute recheck covers sleep/wake while
 * the tab stays focused and the midnight timer never fires.
 *
 * Practice, learn, review, and pack screens subscribe too. Soft-lock and due
 * checks that read this clock refresh when it advances at local midnight or
 * after that 6-hour floor, with no reload. Queues snapshotted at mount
 * (`MemorySessionRunner`, `useFrozenQuery`) keep the verse list they opened
 * with.
 */
let sessionNow: number | undefined;
const sessionNowListeners = new Set<() => void>();

let watchesAttached = false;
let catchUpTimer: number | undefined;
let catchUpInterval: number | undefined;

/** Fallback when a sleep/wake drops the scheduled midnight or lock timer. */
const SESSION_CLOCK_RECHECK_MS = 60 * 1000;

function localDayKey(timestamp: number, tzOffsetMinutes: number): number {
  return Math.floor((timestamp - tzOffsetMinutes * 60 * 1000) / DAY_MS);
}

/**
 * UTC instant of the next local midnight after `timestamp`.
 *
 * `tzOffsetMinutes` is the offset at `timestamp` — that instant's calendar
 * day, the same per-instant offset {@link localDayKey} uses. The offset at
 * "now" mis-reads a spring-forward night: 11pm standard, interpreted as
 * daylight, is already the next local day, so the timer aims a day late.
 */
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
 * expire. Pass each instant's own `getTimezoneOffset()`: one offset applied
 * to both hides a spring-forward midnight (11pm standard time and 3am
 * daylight land on the same day), and catch-up then waits for
 * {@link MIN_LEARNING_LOCK_MS}. Same-day catch-up still waits for that floor
 * so a 10-minute tab switch does not churn query args.
 *
 * `tzOffsetMinutes` is the offset at `currentNow`. `frozenTzOffsetMinutes`
 * defaults to it when the offset did not change.
 */
export function shouldAdvanceSessionNow(
  frozenNow: number,
  currentNow: number,
  tzOffsetMinutes: number,
  frozenTzOffsetMinutes = tzOffsetMinutes,
): boolean {
  if (currentNow <= frozenNow) return false;
  if (
    localDayKey(currentNow, tzOffsetMinutes) !==
    localDayKey(frozenNow, frozenTzOffsetMinutes)
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
  if (sessionNow === undefined) {
    sessionNow = current;
    return false;
  }
  const frozen = sessionNow;
  if (
    !shouldAdvanceSessionNow(
      frozen,
      current,
      new Date(current).getTimezoneOffset(),
      new Date(frozen).getTimezoneOffset(),
    )
  ) {
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

function clearCatchUpInterval(): void {
  if (catchUpInterval === undefined) return;
  window.clearInterval(catchUpInterval);
  catchUpInterval = undefined;
}

function scheduleCatchUpTimer(): void {
  if (typeof window === "undefined") return;
  clearCatchUpTimer();
  const current = Date.now();
  const frozen = getSessionNow();
  const untilMidnight =
    nextLocalMidnightUtc(frozen, new Date(frozen).getTimezoneOffset()) -
    current;
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

/**
 * The scheduled timer is exact when it runs. After sleep it may not run at
 * all while the tab is already focused (`visibilitychange` / `focus` do not
 * fire). The interval only notifies subscribers when the clock actually
 * advances, so a quiet minute does not re-render.
 */
function recheckSessionClock(): void {
  const advanced = maybeAdvanceSessionNow();
  if (advanced || catchUpTimer === undefined) {
    scheduleCatchUpTimer();
  }
}

function startCatchUpInterval(): void {
  if (catchUpInterval !== undefined) return;
  catchUpInterval = window.setInterval(
    recheckSessionClock,
    SESSION_CLOCK_RECHECK_MS,
  );
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
  startCatchUpInterval();
}

function teardownSessionClockWatches(): void {
  if (!watchesAttached || typeof window === "undefined") return;
  watchesAttached = false;
  document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
  window.removeEventListener("focus", handleVisibilityOrFocus);
  window.removeEventListener("pageshow", handleVisibilityOrFocus);
  clearCatchUpTimer();
  clearCatchUpInterval();
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
