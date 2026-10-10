import {
  canonicalPassageId,
  passageVerseSearchIsInvalid,
} from "./passage-path";

/**
 * Canonical route table for Berean HTTP routing.
 *
 * TanStack Router matches these paths in the browser. Vercel middleware and the
 * Vite dev/preview server use the same table so unknown URLs are not rewritten
 * to the sign-in page. Keep this list aligned with `src/routeTree.gen.ts`
 * (a unit test fails when they drift).
 *
 * Dynamic segments keep their original casing, except passage ids, which must
 * name a real chapter and redirect to the canonical book spelling. Static
 * segments are case-insensitive and redirect to the lowercase canonical path.
 * Trailing slashes redirect to the path without one. A passage verse query
 * past the end of that chapter is not a route.
 */

export const CANONICAL_ORIGIN = "https://berean.nathanconnor.dev";

/** Signed-out pages that belong in the public sitemap. */
export const PUBLIC_SITEMAP_PATHS = ["/", "/privacy", "/terms"] as const;

export const APP_ROUTE_PATTERNS = [
  "/",
  "/privacy",
  "/terms",
  "/search",
  "/theme-test",
  "/memory",
  "/memory/learn",
  "/memory/new",
  "/memory/practice",
  "/memory/review",
  "/memory/presets",
  "/settings",
  "/settings/tags",
  "/study",
  "/study/new",
  "/memory/$packId",
  "/memory/$packId/learn",
  "/memory/$packId/practice",
  "/memory/$packId/review",
  "/memory/presets/$presetId",
  "/passage/$passageId",
  "/study/$sessionId",
] as const;

export type AppPathDecision =
  | { type: "serve" }
  | { type: "redirect"; pathname: string }
  | { type: "static-file" }
  | { type: "not-found" };

type RouteSegment = { type: "static"; value: string } | { type: "param" };

interface ParsedPattern {
  segments: RouteSegment[];
  staticCount: number;
}

function parsePattern(pattern: string): ParsedPattern {
  if (pattern === "/") {
    return { segments: [], staticCount: 0 };
  }

  const segments: RouteSegment[] = pattern
    .slice(1)
    .split("/")
    .map((part) =>
      part.startsWith("$")
        ? { type: "param" }
        : { type: "static", value: part.toLowerCase() },
    );

  return {
    segments,
    staticCount: segments.filter((segment) => segment.type === "static").length,
  };
}

const PARSED_PATTERNS = APP_ROUTE_PATTERNS.map(parsePattern).sort((a, b) => {
  if (a.staticCount !== b.staticCount) return b.staticCount - a.staticCount;
  return b.segments.length - a.segments.length;
});

export function normalizeRouteTreePath(path: string): string {
  if (path === "/") return "/";
  const stripped = path.replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

export function publicPageUrl(
  path: (typeof PUBLIC_SITEMAP_PATHS)[number],
): string {
  return path === "/" ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${path}`;
}

function stripTrailingSlashes(pathname: string): string {
  if (pathname === "/") return "/";
  const stripped = pathname.replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

/** Null when the path has an empty segment (`/a//b`), which is never a route. */
function splitSegments(pathname: string): string[] | null {
  if (pathname === "/") return [];
  const parts = pathname.slice(1).split("/");
  if (parts.some((part) => part.length === 0)) return null;
  return parts;
}

function isSafeParam(segment: string): boolean {
  return segment !== "." && segment !== "..";
}

function matchCanonical(segments: readonly string[]): string | null {
  for (const pattern of PARSED_PATTERNS) {
    if (pattern.segments.length !== segments.length) continue;

    const canonicalSegments: string[] = [];
    let matched = true;

    for (let index = 0; index < segments.length; index += 1) {
      const actual = segments[index];
      const expected = pattern.segments[index];
      if (actual === undefined || expected === undefined) {
        matched = false;
        break;
      }

      if (expected.type === "static") {
        if (actual.toLowerCase() !== expected.value) {
          matched = false;
          break;
        }
        canonicalSegments.push(expected.value);
      } else if (!isSafeParam(actual)) {
        matched = false;
        break;
      } else {
        canonicalSegments.push(actual);
      }
    }

    if (!matched) continue;

    const matchedPath =
      canonicalSegments.length === 0 ? "/" : `/${canonicalSegments.join("/")}`;
    const canonical = canonicalizeDynamicPath(pattern, matchedPath);
    if (canonical) return canonical;
  }

  return null;
}

/** Passage ids must name a real chapter. Other params keep their casing. */
function canonicalizeDynamicPath(
  pattern: ParsedPattern,
  matchedPath: string,
): string | null {
  const [head, param] = pattern.segments;
  const isPassage =
    pattern.segments.length === 2 &&
    head?.type === "static" &&
    head.value === "passage" &&
    param?.type === "param";
  if (!isPassage) return matchedPath;

  const passageId = canonicalPassageId(matchedPath.slice("/passage/".length));
  if (!passageId) return null;
  return `/passage/${passageId}`;
}

function hasFileExtension(pathname: string): boolean {
  const slash = pathname.lastIndexOf("/");
  const base = slash === -1 ? pathname : pathname.slice(slash + 1);
  return base.includes(".");
}

export function resolveAppPath(pathname: string, search = ""): AppPathDecision {
  if (!pathname.startsWith("/")) return { type: "not-found" };

  const stripped = stripTrailingSlashes(pathname);
  const segments = splitSegments(stripped);
  if (segments) {
    const canonical = matchCanonical(segments);
    if (canonical) {
      if (passageVerseSearchIsInvalid(canonical, search)) {
        return { type: "not-found" };
      }
      if (pathname !== canonical)
        return { type: "redirect", pathname: canonical };
      return { type: "serve" };
    }
  }

  if (hasFileExtension(stripped)) {
    if (pathname !== stripped) return { type: "redirect", pathname: stripped };
    return { type: "static-file" };
  }

  return { type: "not-found" };
}

/**
 * Href to replace the current location with, or null when the path is already
 * canonical. `searchStr` includes a leading `?` when present. `hash` may
 * include a leading `#` or be the bare fragment TanStack Router exposes.
 */
export function canonicalRedirectHref(
  pathname: string,
  searchStr = "",
  hash = "",
): string | null {
  const decision = resolveAppPath(pathname, searchStr);
  if (decision.type !== "redirect") return null;
  const hashSuffix =
    hash === "" ? "" : hash.startsWith("#") ? hash : `#${hash}`;
  return `${decision.pathname}${searchStr}${hashSuffix}`;
}
