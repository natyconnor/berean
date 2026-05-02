import { createContext, useContext } from "react";

import type { FeatureHintId } from "@/lib/feature-hints";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";

export interface FeatureHintRecord {
  hintId: string;
  shownAt?: number;
  completedAt?: number;
  dismissedAt?: number;
}

export interface StagedOnboardingValue {
  milestones: OnboardingMilestones;
  isHintCompleted: (hintId: FeatureHintId) => boolean;
  isHintDismissed: (hintId: FeatureHintId) => boolean;
  isHintShown: (hintId: FeatureHintId) => boolean;
  /**
   * `pending` means the trigger condition is reached and the hint has not
   * already been shown, completed, or dismissed. The display coordinator still
   * decides which pending hint is allowed to render.
   */
  isHintPending: (hintId: FeatureHintId, trigger: boolean) => boolean;
  isHintDisplayActive: (hintId: FeatureHintId) => boolean;
  requestHintDisplay: (hintId: FeatureHintId, eligible: boolean) => void;
  releaseHintDisplay: (hintId: FeatureHintId) => void;
  markShown: (hintId: FeatureHintId) => void;
  complete: (hintId: FeatureHintId) => void;
  dismiss: (hintId: FeatureHintId) => void;
  /** True while the staged onboarding query result is still loading. */
  isLoading: boolean;
}

export const StagedOnboardingContext =
  createContext<StagedOnboardingValue | null>(null);

export function useStagedOnboarding(): StagedOnboardingValue {
  const ctx = useContext(StagedOnboardingContext);
  if (!ctx) {
    throw new Error(
      "useStagedOnboarding must be used inside StagedOnboardingProvider",
    );
  }
  return ctx;
}

export function useOptionalStagedOnboarding(): StagedOnboardingValue | null {
  return useContext(StagedOnboardingContext);
}
