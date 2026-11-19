/**
 * The shell's URL decisions. No Electron imports, so they can be unit tested
 * (`src/lib/desktop-shell-policy.test.ts`).
 */

import {
  isSignInAttemptId,
  SIGN_IN_ATTEMPT_PARAM,
} from "../shared/desktop-deep-link";

/** How long a `berean://auth` link is accepted after sign-in starts. */
export const SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

/**
 * A sign-in that went to the browser and has not come back yet. `attempt` is
 * the id the web app gave it (see `src/lib/desktop-sign-in-attempt.ts`).
 */
export type PendingSignIn<T> = {
  contents: T;
  attempt: string;
  startedAt: number;
};

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function isSameOrigin(rawUrl: string, origin: string): boolean {
  return parseUrl(rawUrl)?.origin === origin;
}

/**
 * Convex Auth's `signIn` sends the window to
 * `{CONVEX_SITE_URL}/api/auth/signin/{provider}`. The shell does not know
 * which deployment the web app uses (production, preview and dev each have
 * their own), so it matches any Convex site.
 */
export function isConvexSignInUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  return (
    url !== null &&
    url.protocol === "https:" &&
    url.hostname.endsWith(".convex.site") &&
    url.pathname.startsWith("/api/auth/signin/")
  );
}

export function isSignInPending(
  pending: PendingSignIn<unknown> | null,
  now: number,
): boolean {
  return pending !== null && now - pending.startedAt <= SIGN_IN_WINDOW_MS;
}

/**
 * The attempt id a Convex sign-in URL carries, or null. The web app passes
 * `redirectTo: "/desktop-auth.html?signInAttempt=…"` to `signIn`, and Convex
 * Auth copies `redirectTo` onto the sign-in URL as a query param.
 */
export function signInAttemptFromUrl(rawUrl: string): string | null {
  if (!isConvexSignInUrl(rawUrl)) return null;
  const redirectTo = parseUrl(rawUrl)?.searchParams.get("redirectTo");
  if (!redirectTo) return null;
  let attempt: string | null;
  try {
    attempt = new URL(redirectTo, "https://berean.invalid").searchParams.get(
      SIGN_IN_ATTEMPT_PARAM,
    );
  } catch {
    return null;
  }
  return attempt !== null && isSignInAttemptId(attempt) ? attempt : null;
}

/**
 * Where a `berean://auth` code goes: the window that started the pending
 * sign-in, or null to ignore the code. A code is only for the latest sign-in
 * (same attempt id) while it is pending.
 *
 * After "Open browser again" the older tab's code has the older id and is
 * ignored without touching the window; the newer tab's code still gets
 * through. The caller clears the pending sign-in once its code is delivered,
 * so a repeat or stray link cannot reload the window afterwards.
 */
export function signInCodeTarget<T>(
  pending: PendingSignIn<T> | null,
  attempt: string,
  now: number,
): T | null {
  return pending !== null &&
    pending.attempt === attempt &&
    isSignInPending(pending, now)
    ? pending.contents
    : null;
}

/**
 * The `berean:` link in a command line, if any. Used for `second-instance`
 * argv and the app's own launch arguments. The link is still parsed and
 * validated by `parseBereanOpenUrl` before anything opens.
 */
export function findBereanUrl(argv: readonly string[]): string | null {
  return argv.find((arg) => /^berean:/i.test(arg)) ?? null;
}

/** Frames may show the app origin or an empty document, nothing else. */
export function isAllowedFrameUrl(rawUrl: string, appOrigin: string): boolean {
  return (
    rawUrl === "about:blank" ||
    rawUrl === "about:srcdoc" ||
    isSameOrigin(rawUrl, appOrigin)
  );
}
