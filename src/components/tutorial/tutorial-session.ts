const ACTIVE_TUTORIAL_TOUR_KEY = "bible-notes-active-tutorial-tour"

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
}

export type TutorialTourName = "main" | "search"

export function readActiveTutorialTour(): TutorialTourName | null {
  if (!hasWindow()) return null
  try {
    const value = window.sessionStorage.getItem(ACTIVE_TUTORIAL_TOUR_KEY)
    return value === "main" || value === "search" ? value : null
  } catch {
    return null
  }
}

export function writeActiveTutorialTour(tour: TutorialTourName | null) {
  if (!hasWindow()) return
  try {
    if (tour) {
      window.sessionStorage.setItem(ACTIVE_TUTORIAL_TOUR_KEY, tour)
    } else {
      window.sessionStorage.removeItem(ACTIVE_TUTORIAL_TOUR_KEY)
    }
  } catch {
    // ignore sessionStorage failures
  }
}
