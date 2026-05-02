import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";

import type { FeatureHintId } from "@/lib/feature-hints";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";
import { logInteraction } from "@/lib/dev-log";
import { api } from "../../../convex/_generated/api";
import {
  StagedOnboardingContext,
  type FeatureHintRecord,
  type StagedOnboardingValue,
} from "./staged-onboarding-context";

interface StagedOnboardingProviderProps {
  milestones: OnboardingMilestones;
  hints: FeatureHintRecord[];
  isLoading: boolean;
  children: ReactNode;
}

export function StagedOnboardingProvider({
  milestones,
  hints,
  isLoading,
  children,
}: StagedOnboardingProviderProps) {
  const markShownMutation = useMutation(api.onboarding.markHintShown);
  const completeMutation = useMutation(api.onboarding.completeHint);
  const dismissMutation = useMutation(api.onboarding.dismissHint);
  const [activeDisplayHintId, setActiveDisplayHintId] =
    useState<FeatureHintId | null>(null);

  const hintsById = useMemo(() => {
    const map = new Map<string, FeatureHintRecord>();
    for (const hint of hints) {
      map.set(hint.hintId, hint);
    }
    return map;
  }, [hints]);

  const isHintCompleted = useCallback(
    (hintId: FeatureHintId) => hintsById.get(hintId)?.completedAt !== undefined,
    [hintsById],
  );
  const isHintDismissed = useCallback(
    (hintId: FeatureHintId) => hintsById.get(hintId)?.dismissedAt !== undefined,
    [hintsById],
  );
  const isHintShown = useCallback(
    (hintId: FeatureHintId) => hintsById.get(hintId)?.shownAt !== undefined,
    [hintsById],
  );
  const isHintPending = useCallback(
    (hintId: FeatureHintId, trigger: boolean) => {
      if (!trigger) return false;
      if (isLoading) return false;
      const record = hintsById.get(hintId);
      if (!record) return true;
      if (record.shownAt !== undefined) return false;
      if (record.completedAt !== undefined) return false;
      if (record.dismissedAt !== undefined) return false;
      return true;
    },
    [hintsById, isLoading],
  );

  const isHintDisplayActive = useCallback(
    (hintId: FeatureHintId) => activeDisplayHintId === hintId,
    [activeDisplayHintId],
  );

  const requestHintDisplay = useCallback((hintId: FeatureHintId) => {
    setActiveDisplayHintId((current) => current ?? hintId);
  }, []);

  const markShown = useCallback(
    (hintId: FeatureHintId) => {
      const record = hintsById.get(hintId);
      if (record?.shownAt !== undefined) return;
      logInteraction("onboarding", "hint-shown", { hintId });
      void markShownMutation({ hintId });
    },
    [hintsById, markShownMutation],
  );

  const complete = useCallback(
    (hintId: FeatureHintId) => {
      const record = hintsById.get(hintId);
      if (record?.completedAt !== undefined) return;
      logInteraction("onboarding", "hint-completed", { hintId });
      void completeMutation({ hintId });
    },
    [completeMutation, hintsById],
  );

  const dismiss = useCallback(
    (hintId: FeatureHintId) => {
      const record = hintsById.get(hintId);
      if (record?.dismissedAt !== undefined) return;
      logInteraction("onboarding", "hint-dismissed", { hintId });
      void dismissMutation({ hintId });
    },
    [dismissMutation, hintsById],
  );

  const value = useMemo<StagedOnboardingValue>(
    () => ({
      milestones,
      isHintCompleted,
      isHintDismissed,
      isHintShown,
      isHintPending,
      isHintDisplayActive,
      requestHintDisplay,
      markShown,
      complete,
      dismiss,
      isLoading,
    }),
    [
      complete,
      dismiss,
      isHintCompleted,
      isHintDismissed,
      isHintDisplayActive,
      isHintPending,
      isHintShown,
      isLoading,
      markShown,
      milestones,
      requestHintDisplay,
    ],
  );

  return (
    <StagedOnboardingContext.Provider value={value}>
      {children}
    </StagedOnboardingContext.Provider>
  );
}
