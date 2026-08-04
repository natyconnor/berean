/**
 * ESV fetch path preference: text API (default) vs HTML API.
 *
 * Set (pick one):
 *   - DEV UI: “ESV HTML” switch next to Headers (calls `setEsvSource` + retry)
 *   - `setEsvSource("html" | "text")` from code, then retry / remount the chapter
 *   - `localStorage.setItem("berean:esvSource", "html")` then reload
 *   - `?esvSource=html|text` (persists the value in localStorage)
 *
 * Reset to default:
 *   localStorage.removeItem("berean:esvSource")
 */

import type { EsvSource } from "../../shared/esv-api";

export type { EsvSource };

const STORAGE_KEY = "berean:esvSource";

function isEsvSource(value: string | null): value is EsvSource {
  return value === "text" || value === "html";
}

export function resolveEsvSource(): EsvSource {
  if (typeof window === "undefined") return "text";
  try {
    const q = new URLSearchParams(window.location.search);
    const fromQuery = q.get("esvSource");
    if (isEsvSource(fromQuery)) {
      localStorage.setItem(STORAGE_KEY, fromQuery);
      return fromQuery;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isEsvSource(stored)) return stored;
  } catch {
    // localStorage / location unavailable
  }
  return "text";
}

export function setEsvSource(source: EsvSource): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, source);
  } catch {
    // localStorage unavailable
  }
}
