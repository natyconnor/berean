/**
 * Browser IANA timezone for the current viewer (e.g. `America/Los_Angeles`).
 * Used as a Convex query arg so day-bucketing honors local midnights.
 */
export function getViewerTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
