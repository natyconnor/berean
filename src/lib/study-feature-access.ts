import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  shouldRevealStudy,
  type OnboardingMilestones,
} from "@/lib/staged-onboarding-thresholds";

/** Whether Study navigation and routes should be visible to the user. */
export function isStudyFeatureAccessible(
  milestones?: OnboardingMilestones,
): boolean {
  if (!isFeatureEnabled("study")) return false;
  return milestones ? shouldRevealStudy(milestones) : false;
}
