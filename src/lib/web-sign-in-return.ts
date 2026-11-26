/**
 * Website sign-in return.
 *
 * On the website, `/` is a landing page even when signed in. The one
 * exception is coming back from Google sign-in started on that page: then the
 * person goes straight into the app. Google sends the browser back with a
 * fresh page load, so a short-lived marker in sessionStorage (set when sign-in
 * starts) and Convex Auth's `?code=` callback param tell that load apart from
 * a refresh of `/`.
 */

const STORAGE_KEY = "berean.webSignInStartedAt";
const MAX_AGE_MS = 10 * 60 * 1000;

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markWebSignInStarted(): void {
  try {
    safeSessionStorage()?.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage full or blocked: the `?code=` param still marks the return.
  }
}

/** True when this page load is a return from website Google sign-in. */
export function isWebSignInReturn(): boolean {
  if (new URLSearchParams(window.location.search).has("code")) return true;
  const startedAt = Number(safeSessionStorage()?.getItem(STORAGE_KEY));
  return Date.now() - startedAt < MAX_AGE_MS;
}

/** Use the marker up, so a later refresh of `/` shows the landing page. */
export function clearWebSignInReturn(): void {
  safeSessionStorage()?.removeItem(STORAGE_KEY);
}
