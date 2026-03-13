import { createContext, useContext } from "react";

import type { TutorialTourName } from "./tutorial-session";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetIds: string[];
  /** When set, the info card anchors to these elements instead of the spotlight rect. */
  cardAnchorIds?: string[];
}

export interface TutorialContextValue {
  activeTour: TutorialTourName | null;
  activeStep: TutorialStep | null;
  stepIndex: number;
  stepCount: number;
  startTour: (tour: TutorialTourName) => void;
  isTourActive: (tour: TutorialTourName) => boolean;
  isStepActive: (tour: TutorialTourName, stepId: string) => boolean;
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
