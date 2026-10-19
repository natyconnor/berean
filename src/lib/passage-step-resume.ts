/**
 * In-progress passage step, so a reload can skip warm-up and a later open
 * the same day still warms up.
 *
 * sessionStorage survives a reload of this tab and dies with the tab.
 * The stored `origin` is `performance.timeOrigin` from the page that marked
 * the step. A matching origin is this same page load (StrictMode remount).
 * A mismatch on the same path is a real reload. A leftover from another
 * route (typed URL) is a later open. SPA leave clears the marker; a reload
 * does not run React unmount cleanup, so the marker stays for the next load.
 */

export const PASSAGE_STEP_IN_PROGRESS_KEY = "berean:passage-step-in-progress";

type Marker = {
  packId: string;
  origin: number;
  path?: string;
};

function sessionStore(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function readMarker(): Marker | null {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(PASSAGE_STEP_IN_PROGRESS_KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      store.removeItem(PASSAGE_STEP_IN_PROGRESS_KEY);
      return null;
    }
    const marker = toMarker(parsed);
    if (!marker) {
      store.removeItem(PASSAGE_STEP_IN_PROGRESS_KEY);
      return null;
    }
    return marker;
  } catch {
    return null;
  }
}

function toMarker(value: unknown): Marker | null {
  if (!value || typeof value !== "object") return null;
  const packId = (value as { packId?: unknown }).packId;
  const origin = (value as { origin?: unknown }).origin;
  const path = (value as { path?: unknown }).path;
  if (typeof packId !== "string" || typeof origin !== "number") return null;
  if (path !== undefined && typeof path !== "string") return null;
  return path === undefined ? { packId, origin } : { packId, origin, path };
}

function locationPath(): string | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    return window.location.pathname;
  } catch {
    return undefined;
  }
}

function writeMarker(marker: Marker): void {
  try {
    sessionStore()?.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify(marker),
    );
  } catch {
    // Ignore quota and private-mode failures. This visit still continues.
  }
}

let pendingLeaveClear: ReturnType<typeof setTimeout> | undefined;

function cancelPendingLeaveClear(): void {
  if (pendingLeaveClear === undefined) return;
  clearTimeout(pendingLeaveClear);
  pendingLeaveClear = undefined;
}

export function isPassageStepReload(packId: string): boolean {
  const marker = readMarker();
  if (!marker || marker.packId !== packId) return false;
  if (marker.origin === performance.timeOrigin) return false;
  const path = locationPath();
  if (marker.path !== undefined && path !== undefined && marker.path !== path) {
    return false;
  }
  return true;
}

export function markPassageStepInProgress(packId: string): void {
  cancelPendingLeaveClear();
  const existing = readMarker();
  if (
    existing?.packId === packId &&
    existing.origin !== performance.timeOrigin
  ) {
    return;
  }
  const marker: Marker = { packId, origin: performance.timeOrigin };
  const path = locationPath();
  if (path !== undefined) marker.path = path;
  writeMarker(marker);
}

export function clearPassageStepInProgress(packId: string): void {
  cancelPendingLeaveClear();
  const existing = readMarker();
  if (existing?.packId !== packId) return;
  try {
    sessionStore()?.removeItem(PASSAGE_STEP_IN_PROGRESS_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

export function discardPassageStepMarkerIfLandedElsewhere(
  landedPath = locationPath(),
): void {
  const marker = readMarker();
  if (
    marker?.path === undefined ||
    landedPath === undefined ||
    marker.path === landedPath
  ) {
    return;
  }
  clearPassageStepInProgress(marker.packId);
}

/**
 * SPA leave. Delay the clear so a StrictMode remount in this same turn can
 * mark again. A reload never runs this, so the next load still sees a reload.
 */
export function releasePassageStepInProgress(packId: string): void {
  cancelPendingLeaveClear();
  pendingLeaveClear = setTimeout(() => {
    pendingLeaveClear = undefined;
    clearPassageStepInProgress(packId);
  }, 0);
}
