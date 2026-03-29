const ACTIVE_TUTORIAL_TOUR_KEY = "bible-notes-active-tutorial-tour";
const SUPPRESS_SETTINGS_REDIRECT_AFTER_SKIP_KEY =
  "bible-notes-suppress-settings-redirect-after-skip";

function hasWindow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  );
}

export type TutorialTourName = "main" | "search" | "focusMode";

export function readActiveTutorialTour(): TutorialTourName | null {
  if (!hasWindow()) return null;
  try {
    const value = window.sessionStorage.getItem(ACTIVE_TUTORIAL_TOUR_KEY);
    return value === "main" || value === "search" ? value : null;
  } catch {
    return null;
  }
}

export function writeActiveTutorialTour(tour: TutorialTourName | null) {
  if (!hasWindow()) return;
  if (tour === "focusMode") return;
  try {
    if (tour) {
      window.sessionStorage.setItem(ACTIVE_TUTORIAL_TOUR_KEY, tour);
    } else {
      window.sessionStorage.removeItem(ACTIVE_TUTORIAL_TOUR_KEY);
    }
  } catch {
    // ignore sessionStorage failures
  }
}

export function readSuppressSettingsRedirectAfterSkip(): boolean {
  if (!hasWindow()) return false;
  try {
    return (
      window.sessionStorage.getItem(
        SUPPRESS_SETTINGS_REDIRECT_AFTER_SKIP_KEY,
      ) === "true"
    );
  } catch {
    return false;
  }
}

export function writeSuppressSettingsRedirectAfterSkip(value: boolean) {
  if (!hasWindow()) return;
  try {
    if (value) {
      window.sessionStorage.setItem(
        SUPPRESS_SETTINGS_REDIRECT_AFTER_SKIP_KEY,
        "true",
      );
    } else {
      window.sessionStorage.removeItem(
        SUPPRESS_SETTINGS_REDIRECT_AFTER_SKIP_KEY,
      );
    }
  } catch {
    // ignore sessionStorage failures
  }
}
