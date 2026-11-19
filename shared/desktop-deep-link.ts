import { resolveAppPath } from "./http-routes";

/**
 * Parsing for `berean:` links handed to the desktop app by the OS.
 *
 * Pure: no DOM and no Electron imports, so the web tests and the Electron main
 * process share one implementation. Route links are validated against the same
 * route table the web server uses (`resolveAppPath`), so a new web route is
 * deep-linkable with no change here.
 */

export type BereanRouteTarget = {
  kind: "route";
  pathname: string;
  search: string;
  hash: string;
};

/**
 * `attempt` identifies the sign-in the code belongs to (see
 * `src/lib/desktop-sign-in-attempt.ts`). Absent on links from before it
 * existed.
 */
export type BereanAuthTarget = {
  kind: "auth";
  code: string;
  attempt?: string;
};

export type BereanOpenTarget = BereanRouteTarget | BereanAuthTarget;

const SCHEME_PREFIX = /^berean:/i;
const AUTH_PATHNAME = "/auth";
const MAX_AUTH_CODE_LENGTH = 512;
const MAX_URL_LENGTH = 4096;

/** The query param that carries a sign-in attempt id, on every hop. */
export const SIGN_IN_ATTEMPT_PARAM = "signInAttempt";

/** A `crypto.randomUUID()` fits; so does anything URL-safe of similar size. */
const SIGN_IN_ATTEMPT_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isSignInAttemptId(value: string): boolean {
  return SIGN_IN_ATTEMPT_PATTERN.test(value);
}

/** Only used to split path, query and hash; never appears in a result. */
const PARSE_BASE = "https://berean.invalid";

/**
 * `berean://passage/John-1?startVerse=3` → route
 * `berean:///passage/John-1`             → route (some OSes add a slash)
 * `berean://auth?code=abc123`            → auth
 * `berean://auth?code=abc&signInAttempt=…` → auth, with its attempt id
 *
 * Returns null for every other scheme and for anything that is not an app
 * route or a well-formed auth callback.
 */
export function parseBereanOpenUrl(raw: string): BereanOpenTarget | null {
  if (raw.length > MAX_URL_LENGTH) return null;

  const scheme = SCHEME_PREFIX.exec(raw);
  if (!scheme) return null;

  // Everything after the scheme is treated as a path, so `berean://passage/x`
  // and `berean:///passage/x` both mean `/passage/x`. There is no host.
  const rest = raw.slice(scheme[0].length).replace(/^\/+/, "");

  let parsed: URL;
  try {
    parsed = new URL(`/${rest}`, PARSE_BASE);
  } catch {
    return null;
  }

  // `/\host/...` would be read as a new authority; a link must stay a path.
  if (parsed.origin !== PARSE_BASE) return null;

  if (parsed.pathname === AUTH_PATHNAME) {
    const code = parsed.searchParams.get("code");
    if (!code || code.length > MAX_AUTH_CODE_LENGTH) return null;
    const attempt = parsed.searchParams.get(SIGN_IN_ATTEMPT_PARAM);
    if (attempt === null) return { kind: "auth", code };
    if (!isSignInAttemptId(attempt)) return null;
    return { kind: "auth", code, attempt };
  }

  const pathname = resolveRoutePathname(parsed.pathname, parsed.search);
  if (pathname === null) return null;

  return {
    kind: "route",
    pathname,
    search: parsed.search,
    hash: parsed.hash,
  };
}

/** The canonical app path for `pathname`, or null when it is not a route. */
function resolveRoutePathname(pathname: string, search: string): string | null {
  const decision = resolveAppPath(pathname, search);
  if (decision.type === "serve") return pathname;
  if (decision.type !== "redirect") return null;

  // A redirect can also point at a static file (`/robots.txt/`), so the
  // canonical path has to be a served route in its own right.
  return resolveAppPath(decision.pathname, search).type === "serve"
    ? decision.pathname
    : null;
}

/**
 * `{origin}{pathname}{search}{hash}`. `origin` is `CANONICAL_ORIGIN` or the
 * `BEREAN_DESKTOP_URL` override.
 */
export function toAppUrl(
  origin: string,
  target: { pathname: string; search: string; hash: string },
): string {
  return `${origin.replace(/\/+$/, "")}${target.pathname}${target.search}${target.hash}`;
}

/**
 * Sets `?code=` (and the sign-in attempt id, when there is one) on
 * `currentUrl`, replacing any existing values.
 */
export function withAuthCode(
  currentUrl: string,
  code: string,
  attempt?: string,
): string {
  const url = new URL(currentUrl);
  url.searchParams.set("code", code);
  if (attempt === undefined) {
    url.searchParams.delete(SIGN_IN_ATTEMPT_PARAM);
  } else {
    url.searchParams.set(SIGN_IN_ATTEMPT_PARAM, attempt);
  }
  return url.toString();
}
