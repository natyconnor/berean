/**
 * Last-visited href for each Mode Dock destination.
 *
 * The dock treats Notes, Memory, and Study as independent app states: leaving
 * Memory to write a note should return you to the pack or review you left,
 * not always the Memory dashboard.
 */

import { validateMemoryPackSearch } from "@/lib/memory-pack-search";
import { validateMemoryVerseSearch } from "@/lib/memory-verse-search";

export type AppMode = "notes" | "memory" | "study";

export type ModeLastLocations = Partial<Record<AppMode, string>>;

export const MODE_LAST_LOCATION_STORAGE_KEY = "bible-notes-mode-last-location";

export const DEFAULT_MODE_HREFS: Record<AppMode, string> = {
  notes: "/passage/John-1",
  memory: "/memory",
  study: "/study",
};

export function modeForPathname(pathname: string): AppMode | null {
  if (pathname === "/memory" || pathname.startsWith("/memory/")) {
    return "memory";
  }
  if (pathname === "/study" || pathname.startsWith("/study/")) {
    return "study";
  }
  if (pathname.startsWith("/passage/")) {
    return "notes";
  }
  return null;
}

function pathnameFromHref(href: string): string {
  const withoutHash = href.split("#")[0] ?? href;
  const withoutSearch = withoutHash.split("?")[0] ?? withoutHash;
  return withoutSearch;
}

/** Relative in-app hrefs only; never protocol-relative or parent-segment paths. */
export function isValidModeHref(mode: AppMode, href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  if (href.includes("..")) return false;
  const pathname = pathnameFromHref(href);
  if (pathname.includes("//")) return false;
  return modeForPathname(pathname) === mode;
}

function parseStoredLocations(raw: unknown): ModeLastLocations {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;
  const next: ModeLastLocations = {};
  for (const mode of ["notes", "memory", "study"] as const) {
    const href = value[mode];
    if (typeof href === "string" && isValidModeHref(mode, href)) {
      next[mode] = href;
    }
  }
  return next;
}

function readSessionItem(): string | null {
  try {
    return sessionStorage.getItem(MODE_LAST_LOCATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSessionItem(value: string): void {
  try {
    sessionStorage.setItem(MODE_LAST_LOCATION_STORAGE_KEY, value);
  } catch {
    // ignore quota / private-mode failures
  }
}

export function readModeLastLocations(): ModeLastLocations {
  const saved = readSessionItem();
  if (!saved) return {};
  try {
    return parseStoredLocations(JSON.parse(saved) as unknown);
  } catch {
    return {};
  }
}

export function writeModeLastLocations(locations: ModeLastLocations): void {
  writeSessionItem(JSON.stringify(parseStoredLocations(locations)));
}

export function clearModeLastLocations(): void {
  try {
    sessionStorage.removeItem(MODE_LAST_LOCATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Record the current page as the last location for its mode. Returns the
 * updated map when something changed, otherwise `null`.
 */
export function rememberModeLocation(
  pathname: string,
  href: string,
  current: ModeLastLocations = readModeLastLocations(),
): ModeLastLocations | null {
  const mode = modeForPathname(pathname);
  if (!mode || !isValidModeHref(mode, href)) return null;
  if (current[mode] === href) return null;
  const next: ModeLastLocations = { ...current, [mode]: href };
  writeModeLastLocations(next);
  return next;
}

export function resolveModeHref(
  mode: AppMode,
  stored: ModeLastLocations,
  fallback?: string,
): string {
  const href = stored[mode];
  if (href && isValidModeHref(mode, href)) return href;
  if (fallback && isValidModeHref(mode, fallback)) return fallback;
  return DEFAULT_MODE_HREFS[mode];
}

export type ModeNavigateTarget =
  | {
      to: "/passage/$passageId";
      params: { passageId: string };
      search: {
        startVerse?: number;
        endVerse?: number;
        mode?: "compose" | "read";
        source?: "search";
      };
    }
  | { to: "/memory" }
  | { to: "/memory/new" }
  | {
      to: "/memory/learn" | "/memory/practice" | "/memory/review";
      search: ReturnType<typeof validateMemoryVerseSearch>;
    }
  | {
      to: "/memory/$packId";
      params: { packId: string };
      search: ReturnType<typeof validateMemoryPackSearch>;
    }
  | {
      to:
        | "/memory/$packId/learn"
        | "/memory/$packId/practice"
        | "/memory/$packId/review";
      params: { packId: string };
      search: ReturnType<typeof validateMemoryVerseSearch>;
    }
  | { to: "/study" }
  | { to: "/study/new" }
  | { to: "/study/$sessionId"; params: { sessionId: string } };

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return undefined;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : undefined;
}

function passageSearchFromParams(params: URLSearchParams): {
  startVerse?: number;
  endVerse?: number;
  mode?: "compose" | "read";
  source?: "search";
} {
  const startVerse = parsePositiveInt(params.get("startVerse"));
  const endVerseCandidate = parsePositiveInt(params.get("endVerse"));
  const endVerse =
    typeof startVerse === "number" && typeof endVerseCandidate === "number"
      ? Math.max(startVerse, endVerseCandidate)
      : startVerse;
  const modeRaw = params.get("mode");
  const mode =
    modeRaw === "compose" || modeRaw === "read" ? modeRaw : undefined;
  const source = params.get("source") === "search" ? "search" : undefined;
  return {
    ...(startVerse !== undefined ? { startVerse, endVerse } : {}),
    ...(mode ? { mode } : {}),
    ...(source ? { source } : {}),
  };
}

/**
 * Turn a stored mode href into a typed TanStack `navigate()` target so dock
 * switches use the same route table as in-app links (not a raw `href` string).
 */
export function modeNavigateTargetFromHref(
  href: string,
): ModeNavigateTarget | null {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("..")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href, "http://berean.local");
  } catch {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const searchRecord = Object.fromEntries(url.searchParams.entries());
  const verseSearch = validateMemoryVerseSearch(searchRecord);

  if (parts[0] === "passage" && parts.length === 2 && parts[1]) {
    return {
      to: "/passage/$passageId",
      params: { passageId: decodeURIComponent(parts[1]) },
      search: passageSearchFromParams(url.searchParams),
    };
  }

  if (parts[0] === "memory") {
    if (parts.length === 1) return { to: "/memory" };
    if (parts.length === 2 && parts[1] === "new") return { to: "/memory/new" };
    if (parts.length === 2 && parts[1] === "learn") {
      return { to: "/memory/learn", search: verseSearch };
    }
    if (parts.length === 2 && parts[1] === "practice") {
      return { to: "/memory/practice", search: verseSearch };
    }
    if (parts.length === 2 && parts[1] === "review") {
      return { to: "/memory/review", search: verseSearch };
    }
    if (parts.length === 2 && parts[1]) {
      return {
        to: "/memory/$packId",
        params: { packId: parts[1] },
        search: validateMemoryPackSearch(searchRecord),
      };
    }
    if (parts.length === 3 && parts[1] && parts[2] === "learn") {
      return {
        to: "/memory/$packId/learn",
        params: { packId: parts[1] },
        search: verseSearch,
      };
    }
    if (parts.length === 3 && parts[1] && parts[2] === "practice") {
      return {
        to: "/memory/$packId/practice",
        params: { packId: parts[1] },
        search: verseSearch,
      };
    }
    if (parts.length === 3 && parts[1] && parts[2] === "review") {
      return {
        to: "/memory/$packId/review",
        params: { packId: parts[1] },
        search: verseSearch,
      };
    }
  }

  if (parts[0] === "study") {
    if (parts.length === 1) return { to: "/study" };
    if (parts.length === 2 && parts[1] === "new") return { to: "/study/new" };
    if (parts.length === 2 && parts[1]) {
      return { to: "/study/$sessionId", params: { sessionId: parts[1] } };
    }
  }

  return null;
}
