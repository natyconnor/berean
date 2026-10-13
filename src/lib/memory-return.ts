/**
 * Where a Memory session goes when it is done: an internal path with its
 * search string, carried in the session's `return` search param. Only a few
 * in-app paths are allowed so the param can never send someone off-site.
 */

const MAX_RETURN_LENGTH = 512;

const RETURN_PATH_PATTERN = /^\/(?:memory(?:\/[^?#]*)?|passage\/[^?#]+)$/;

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** A safe `return` value, or `undefined` for anything else. */
export function parseMemoryReturn(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw.length === 0 || raw.length > MAX_RETURN_LENGTH) return undefined;
  if (CONTROL_CHARACTERS.test(raw)) return undefined;
  if (raw.includes("\\") || raw.includes("//") || raw.includes("#")) {
    return undefined;
  }

  const queryStart = raw.indexOf("?");
  const path = queryStart === -1 ? raw : raw.slice(0, queryStart);
  if (!RETURN_PATH_PATTERN.test(path)) return undefined;
  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return undefined;
  }
  return raw;
}

export interface MemoryReturnSearch {
  /** Where Done and the session's back link go. */
  return?: string;
}

/** The `return` search param of a session route; dropped when not allowed. */
export function validateMemoryReturnSearch(
  search: Record<string, unknown>,
): MemoryReturnSearch {
  const returnTo = parseMemoryReturn(search.return);
  return returnTo === undefined ? {} : { return: returnTo };
}

/** `href` with `return=<returnTo>` added; unchanged when `returnTo` is not allowed. */
export function withReturn(href: string, returnTo: string): string {
  const safe = parseMemoryReturn(returnTo);
  if (safe === undefined) return href;

  const hashStart = href.indexOf("#");
  const base = hashStart === -1 ? href : href.slice(0, hashStart);
  const hash = hashStart === -1 ? "" : href.slice(hashStart);
  const queryStart = base.indexOf("?");
  const path = queryStart === -1 ? base : base.slice(0, queryStart);
  const params = new URLSearchParams(
    queryStart === -1 ? "" : base.slice(queryStart + 1),
  );
  params.set("return", safe);
  return `${path}?${params.toString()}${hash}`;
}
