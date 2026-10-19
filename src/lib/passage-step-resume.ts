/**
 * In-progress passage step, so a reload can skip warm-up and a later open
 * the same day (Extra practice, another step) still warms up.
 *
 * sessionStorage survives a reload of this tab and dies with the tab.
 * The stored `origin` is `performance.timeOrigin` from the page that marked
 * the step. A matching origin is this same page load (StrictMode remount or
 * a leftover after SPA leave). A mismatch is a real reload.
 */

export const PASSAGE_STEP_IN_PROGRESS_KEY = "berean:passage-step-in-progress";

type Marker = {
  packId: string;
  origin: number;
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
  if (typeof packId !== "string" || typeof origin !== "number") return null;
  return { packId, origin };
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

export function isPassageStepReload(packId: string): boolean {
  const marker = readMarker();
  if (!marker || marker.packId !== packId) return false;
  return marker.origin !== performance.timeOrigin;
}

export function markPassageStepInProgress(packId: string): void {
  const existing = readMarker();
  if (
    existing?.packId === packId &&
    existing.origin !== performance.timeOrigin
  ) {
    return;
  }
  writeMarker({ packId, origin: performance.timeOrigin });
}

export function clearPassageStepInProgress(packId: string): void {
  const existing = readMarker();
  if (existing?.packId !== packId) return;
  try {
    sessionStore()?.removeItem(PASSAGE_STEP_IN_PROGRESS_KEY);
  } catch {
    // sessionStorage unavailable
  }
}
