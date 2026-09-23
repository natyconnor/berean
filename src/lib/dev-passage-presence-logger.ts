/**
 * Dev-only: logs verse-list presence (first-open vs in-place retarget vs close)
 * to the app logger overlay.
 *
 * Enable (pick one):
 *   localStorage.setItem("berean:debugPassagePresence", "1")
 *   then reload.
 *
 * Or open the app with ?debugPassagePresence=1 (persists the flag in localStorage).
 *
 * Disable:
 *   localStorage.removeItem("berean:debugPassagePresence")
 */

import { devLog } from "@/lib/dev-log";

const STORAGE_KEY = "berean:debugPassagePresence";

export function passagePresenceDebugEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("debugPassagePresence") === "1") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function logPassagePresence(details: Record<string, unknown>): void {
  if (!passagePresenceDebugEnabled()) return;
  devLog.debug("passage-presence", details);
}
