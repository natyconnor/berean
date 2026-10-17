import { createContext, useContext, type ReactNode } from "react";

import type { TutorialTourName } from "./tutorial-session";

export interface TutorialStepContext {
  /** Current route, e.g. `/passage/John-1`. */
  pathname: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  description: ReactNode | ((context: TutorialStepContext) => ReactNode);
  targetIds: string[];
  /** When set, the info card anchors to these elements instead of the spotlight rect. */
  cardAnchorIds?: string[];
  /** If set, this target is scrolled into view (e.g. center) instead of the first spotlight target. */
  scrollIntoViewTargetId?: string;
  /**
   * Show a centered card when no target is on screen (e.g. a control hidden in
   * Focus mode) instead of waiting for one to appear.
   */
  centerWhenTargetMissing?: boolean;
}

export interface TutorialContextValue {
  activeTour: TutorialTourName | null;
  activeStep: TutorialStep | null;
  stepIndex: number;
  stepCount: number;
  startTour: (tour: TutorialTourName) => void;
  isTourActive: (tour: TutorialTourName) => boolean;
  isStepActive: (tour: TutorialTourName, stepId: string) => boolean;
  isMainTutorialComplete: boolean;
  isFocusModeTutorialComplete: boolean;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
}

export function useOptionalTutorial() {
  return useContext(TutorialContext);
}
