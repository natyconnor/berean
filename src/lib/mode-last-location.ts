/**
 * Last-visited href for each Mode Dock destination.
 *
 * The dock treats Notes, Memory, and Study as independent app states: leaving
 * Memory to write a note should return you to the pack or review you left,
 * not always the Memory dashboard.
 */

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
