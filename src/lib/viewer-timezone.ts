/**
 * Browser IANA timezone for the current viewer (e.g. `America/Los_Angeles`).
 * Used as a Convex query arg so day-bucketing honors local midnights.
 */
export function getViewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Offset plus IANA zone for scheduler mutations that land on local midnight. */
export function viewerZone(now: number): {
  tzOffsetMinutes: number;
  timeZone: string;
} {
  return {
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
    timeZone: getViewerTimeZone(),
  };
}
