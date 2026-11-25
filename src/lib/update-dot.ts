/**
 * The dot on the desktop app's update arrow. "Not now" drops it for the
 * update that is ready, in every window; something newer brings it back.
 */

/** What is ready: a downloaded shell version, a new web build, or both. */
export type ReadyUpdate = {
  shellVersion: string | null;
  webBuildId: string | null;
};

/** Shared by every window: they all load the app origin in one session. */
const DISMISSED_STORAGE_KEY = "berean:update-dot-dismissed";

/**
 * Whether the dot shows, given what the user last chose "Not now" for (a).
 * It comes back when a shell version or web build is ready that was not
 * ready then; the same update staying ready keeps it off.
 */
export function maybeRestoreDot(
  ready: ReadyUpdate,
  dismissed: ReadyUpdate | null,
): boolean {
  if (dismissed === null) return true;
  return (
    (ready.shellVersion !== null &&
      ready.shellVersion !== dismissed.shellVersion) ||
    (ready.webBuildId !== null && ready.webBuildId !== dismissed.webBuildId)
  );
}

function parseDismissed(raw: string | null): ReadyUpdate | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { shellVersion, webBuildId } = value as Record<string, unknown>;
    return {
      shellVersion: typeof shellVersion === "string" ? shellVersion : null,
      webBuildId: typeof webBuildId === "string" ? webBuildId : null,
    };
  } catch {
    return null;
  }
}

export function readDotDismissed(): ReadyUpdate | null {
  try {
    return parseDismissed(window.localStorage.getItem(DISMISSED_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Records "Not now" where every window sees it (b). Other windows hear it
 * through `subscribeToDotDismissed`; this window updates its own state.
 */
export function syncDotDismissedAcrossWindows(dismissed: ReadyUpdate): void {
  try {
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify(dismissed),
    );
  } catch {
    // Storage blocked: the dot still drops in this window.
  }
}

/** Calls `listener` when another window chooses "Not now". */
export function subscribeToDotDismissed(
  listener: (dismissed: ReadyUpdate | null) => void,
): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== DISMISSED_STORAGE_KEY) return;
    listener(parseDismissed(event.newValue));
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
