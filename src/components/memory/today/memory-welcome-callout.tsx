import { useEffect, useState } from "react";

import { InlineFeatureCallout } from "@/components/tutorial/inline-feature-callout";
import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { cn } from "@/lib/utils";

const MISSED_SLOT_MS = 1000;

const WELCOME_DESCRIPTION =
  "Memorize a verse or passage and it lives here. Come back each day: Today shows what's ready, and one button starts it. Hearting a verse just saves it; it never adds work.";

export function MemoryWelcomeCallout({
  ready,
  firstRun,
}: {
  ready: boolean;
  firstRun: boolean;
}) {
  const [missedSlot, setMissedSlot] = useState(false);
  const onboarding = useOptionalStagedOnboarding();
  const hintsLoaded = onboarding !== null && !onboarding.isLoading;
  const state = useFeatureHint(
    FEATURE_HINTS.MEMORY_FIRST_OPEN_EXPLAINER,
    ready && !missedSlot,
  );

  useEffect(() => {
    if (!ready || !hintsLoaded || missedSlot || state.pending) return;
    const timer = window.setTimeout(() => {
      setMissedSlot(true);
    }, MISSED_SLOT_MS);
    return () => window.clearTimeout(timer);
  }, [hintsLoaded, missedSlot, ready, state.pending]);

  return (
    <InlineFeatureCallout
      state={state}
      title="Welcome to Memory"
      description={WELCOME_DESCRIPTION}
      dismissLabel="Dismiss"
      className={cn(
        "px-4 py-3 text-sm sm:px-5 mb-3",
        firstRun && "mx-auto max-w-[920px]",
      )}
    />
  );
}
