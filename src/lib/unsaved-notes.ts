/**
 * App-wide view of unsaved notes, for code outside the passage view: the
 * update arrow's restart or refresh, and the desktop shell's quit and
 * restart guards. The passage notes UI reports into it; the "Discard unsaved
 * notes?" dialog mounted in the app shell answers `requestDiscardUnsavedNotes`.
 */

const dirtyOwners = new Set<string>();

/** Reports whether one notes UI (`owner`) has unsaved notes. */
export function setUnsavedNotes(owner: string, isDirty: boolean): void {
  const hadUnsaved = dirtyOwners.size > 0;
  if (isDirty) {
    dirtyOwners.add(owner);
  } else {
    dirtyOwners.delete(owner);
  }
  const hasUnsaved = dirtyOwners.size > 0;
  if (hasUnsaved !== hadUnsaved) {
    window.bereanDesktop?.setHasUnsavedNotes?.(hasUnsaved);
  }
}

/** Whether this window has unsaved notes. */
export function hasUnsavedNotes(): boolean {
  return dirtyOwners.size > 0;
}

/**
 * Whether any window has unsaved notes. Outside the desktop shell (or on a
 * shell too old to say) that is just this window.
 */
export async function hasUnsavedNotesInAnyWindow(): Promise<boolean> {
  if (hasUnsavedNotes()) return true;
  return (await window.bereanDesktop?.hasUnsavedNotes?.()) === true;
}

let pendingRequest: {
  promise: Promise<boolean>;
  resolve: (discard: boolean) => void;
} | null = null;
const requestListeners = new Set<() => void>();

function emitRequestChange(): void {
  for (const listener of requestListeners) listener();
}

/**
 * Opens "Discard unsaved notes?" and resolves true for Discard, false for
 * Keep editing. A second request while it is open shares the first answer.
 */
export function requestDiscardUnsavedNotes(): Promise<boolean> {
  if (pendingRequest) return pendingRequest.promise;
  let resolve: (discard: boolean) => void = () => undefined;
  const promise = new Promise<boolean>((resolvePromise) => {
    resolve = resolvePromise;
  });
  pendingRequest = { promise, resolve };
  emitRequestChange();
  return promise;
}

export function answerDiscardRequest(discard: boolean): void {
  const request = pendingRequest;
  if (!request) return;
  pendingRequest = null;
  emitRequestChange();
  request.resolve(discard);
}

export function isDiscardRequestOpen(): boolean {
  return pendingRequest !== null;
}

export function subscribeToDiscardRequest(listener: () => void): () => void {
  requestListeners.add(listener);
  return () => {
    requestListeners.delete(listener);
  };
}
