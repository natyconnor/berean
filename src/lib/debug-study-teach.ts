/**
 * Optional diagnostics for Teach / study deck (dev log overlay).
 *
 * Enable (pick one):
 *   localStorage.setItem("berean:debugStudyTeach", "1")
 *   then reload.
 *
 * Or open the app with ?debugStudyTeach=1 (persists the flag in localStorage).
 *
 * Disable:
 *   localStorage.removeItem("berean:debugStudyTeach")
 */

const STORAGE_KEY = "berean:debugStudyTeach";

export function studyTeachDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("debugStudyTeach") === "1") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
