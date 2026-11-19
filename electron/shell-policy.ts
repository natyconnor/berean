/**
 * The shell's URL decisions. No Electron imports, so they can be unit tested
 * (`src/lib/desktop-shell-policy.test.ts`).
 */

/** How long a `berean://auth` link is accepted after sign-in starts. */
export const SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

/** A sign-in that went to the browser and has not come back yet. */
export type PendingSignIn<T> = { contents: T; startedAt: number };

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
 * Where a `berean://auth` code goes: the window that started the pending
 * sign-in, or null to ignore the code (no sign-in started, or it expired).
 *
 * Reading this does not use the sign-in up. After "Open browser again" the
 * older tab's code can arrive first; the newer tab's code must still get
 * through. The web app decides which code to redeem (see
 * `src/lib/desktop-sign-in-attempt.ts`).
 */
export function signInCodeTarget<T>(
  pending: PendingSignIn<T> | null,
  now: number,
): T | null {
  return pending !== null && isSignInPending(pending, now)
    ? pending.contents
    : null;
}

/** Frames may show the app origin or an empty document, nothing else. */
export function isAllowedFrameUrl(rawUrl: string, appOrigin: string): boolean {
  return (
    rawUrl === "about:blank" ||
    rawUrl === "about:srcdoc" ||
    isSameOrigin(rawUrl, appOrigin)
  );
}
