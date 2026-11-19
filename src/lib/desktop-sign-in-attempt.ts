import {
  isSignInAttemptId,
  SIGN_IN_ATTEMPT_PARAM,
} from "../../shared/desktop-deep-link";
import {
  DESKTOP_AUTH_REDIRECT_PATH,
  isBereanDesktop,
} from "./desktop-platform";

/**
 * Desktop sign-in attempts.
 *
 * Every desktop sign-in gets a random id that travels with it: in the
 * `redirectTo` Convex Auth sends the browser back to, through
 * `desktop-auth.html`, the `berean://auth` link and the shell's reload.
 * When a `?code=` arrives, the app redeems it only if its id is the latest
 * attempt, and only once.
 *
 * Why: Convex Auth keeps a single verifier, overwritten by each `signIn`, and
 * deletes it before it tries a code. Without this check:
 * - after "Open browser again", finishing the older tab spends the newer
 *   verifier on a code that cannot match it, so the newer tab then fails too;
 * - a code that arrives after sign-in succeeded (the hand-back page opening
 *   Berean twice, or a second tab) fails and signs the user out.
 */

const STORAGE_KEY = "berean.desktopSignInAttempt";

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function newAttemptId(): string {
  return crypto.randomUUID();
}

/**
 * Starts a desktop sign-in attempt, replacing any earlier one, and returns
 * the `redirectTo` for `signIn`.
 */
export function startDesktopSignInAttempt(): string {
  const attempt = newAttemptId();
  safeStorage()?.setItem(STORAGE_KEY, attempt);
  const search = new URLSearchParams({ [SIGN_IN_ATTEMPT_PARAM]: attempt });
  return `${DESKTOP_AUTH_REDIRECT_PATH}?${search.toString()}`;
}

function replaceSearch(url: URL): void {
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

/**
 * `ConvexAuthProvider`'s `shouldHandleCode`. Called once on load when the URL
 * has `?code=`.
 *
 * On the web, and for a code without an attempt id, it keeps Convex Auth's
 * default (redeem it). In the desktop app a code with an attempt id is
 * redeemed only if that id is the pending attempt, which is then used up.
 * A code that is not redeemed is removed from the URL, and the current
 * session (signed in or not) is left alone.
 */
export function shouldHandleSignInCode(): boolean {
  const url = new URL(window.location.href);
  const attempt = url.searchParams.get(SIGN_IN_ATTEMPT_PARAM);
  if (attempt === null || !isBereanDesktop()) return true;

  url.searchParams.delete(SIGN_IN_ATTEMPT_PARAM);
  const storage = safeStorage();
  const pending = storage?.getItem(STORAGE_KEY) ?? null;
  const isPending = isSignInAttemptId(attempt) && attempt === pending;

  if (isPending) {
    storage?.removeItem(STORAGE_KEY);
  } else {
    url.searchParams.delete("code");
  }
  // Convex Auth strips `code` itself when it redeems one.
  replaceSearch(url);
  return isPending;
}
