import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import {
  useFeatureHint,
  type FeatureHintState,
} from "@/components/tutorial/use-feature-hint";
import { FEATURE_HINTS, type FeatureHintId } from "@/lib/feature-hints";
import { firstMasteredCopy } from "@/lib/memory-milestones";

/**
 * A once-ever celebration stored as a feature hint: pending until completed,
 * and never pending before the hint records load (so it can't show twice).
 */
export function useMilestoneHint(hintId: FeatureHintId): FeatureHintState {
  const onboarding = useOptionalStagedOnboarding();
  const loaded = onboarding !== null && !onboarding.isLoading;
  return useFeatureHint(hintId, loaded, { useDisplayQueue: false });
}

/** `celebrate(reference)` toasts the first verse or passage ever mastered. */
export function useFirstMasteredToast(): (reference: string) => void {
  const { pending, complete } = useMilestoneHint(
    FEATURE_HINTS.CELEBRATE_FIRST_MASTERED,
  );
  // A grade can be adopted twice (local hold, then the server's), before
  // `complete` lands in the hint records.
  const celebrated = useRef(false);
  return useCallback(
    (reference: string) => {
      if (!pending || celebrated.current) return;
      celebrated.current = true;
      complete();
      const { title, description } = firstMasteredCopy(reference);
      toast.success(title, { description });
    },
    [complete, pending],
  );
}
