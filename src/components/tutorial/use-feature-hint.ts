import { useCallback, useEffect } from "react";

import type { FeatureHintId } from "@/lib/feature-hints";
import {
  useOptionalStagedOnboarding,
  type StagedOnboardingValue,
} from "./staged-onboarding-context";

export interface FeatureHintState {
  /** True when the trigger is met and the user has not completed/dismissed it. */
  pending: boolean;
  /** Whether the hint has been completed (e.g. user took the action). */
  completed: boolean;
  /** Whether the hint has been dismissed (e.g. user closed the callout). */
  dismissed: boolean;
  /** Whether the hint has previously been shown to the user. */
  shown: boolean;
  /** Mark the hint as completed (action taken). No-op if already completed. */
  complete: () => void;
  /** Dismiss the hint without completing. No-op if already dismissed. */
  dismiss: () => void;
  /**
   * Mark the hint as shown. Components mounting a callout should call this in
   * a useEffect to record exposure analytics; calling repeatedly is safe.
   */
  markShown: () => void;
}

interface UseFeatureHintOptions {
  /**
   * Most hints participate in the global display queue so only one education
   * card appears per app load. Set this to false for follow-up explainers that
   * are already scoped to a destination screen the user intentionally opened.
   */
  useDisplayQueue?: boolean;
}

const NOOP_STATE: FeatureHintState = {
  pending: false,
  completed: false,
  dismissed: false,
  shown: false,
  complete: () => {},
  dismiss: () => {},
  markShown: () => {},
};

/**
 * Hook that bundles a hint's trigger condition with its persisted state, so
 * components can render a callout/dialog only while the hint is "pending".
 */
export function useFeatureHint(
  hintId: FeatureHintId,
  trigger: boolean,
  options: UseFeatureHintOptions = {},
): FeatureHintState {
  const ctx = useOptionalStagedOnboarding();
  return useFeatureHintWithContext(hintId, trigger, ctx, options);
}

function useFeatureHintWithContext(
  hintId: FeatureHintId,
  trigger: boolean,
  ctx: StagedOnboardingValue | null,
  { useDisplayQueue = true }: UseFeatureHintOptions,
): FeatureHintState {
  const complete = useCallback(() => {
    ctx?.complete(hintId);
  }, [ctx, hintId]);
  const dismiss = useCallback(() => {
    ctx?.dismiss(hintId);
  }, [ctx, hintId]);
  const markShown = useCallback(() => {
    ctx?.markShown(hintId);
  }, [ctx, hintId]);

  const eligible = ctx?.isHintPending(hintId, trigger) ?? false;
  const active = ctx?.isHintDisplayActive(hintId) ?? false;
  const completed = ctx?.isHintCompleted(hintId) ?? false;
  const dismissed = ctx?.isHintDismissed(hintId) ?? false;
  const shown = ctx?.isHintShown(hintId) ?? false;

  useEffect(() => {
    if (!ctx || !eligible || !useDisplayQueue) return;
    ctx.requestHintDisplay(hintId);
  }, [ctx, eligible, hintId, useDisplayQueue]);

  if (!ctx) return NOOP_STATE;

  return {
    pending: (useDisplayQueue ? active : trigger) && !completed && !dismissed,
    completed,
    dismissed,
    shown,
    complete,
    dismiss,
    markShown,
  };
}

/**
 * Convenience effect: when a hint is pending and the surface is mounted,
 * record `shownAt` exactly once. Components that conditionally render their
 * callout based on `pending` can call this from inside the callout.
 */
export function useMarkHintShownWhenPending(state: FeatureHintState) {
  useEffect(() => {
    if (!state.pending || state.shown) return;
    state.markShown();
  }, [state]);
}
