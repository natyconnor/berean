import { useState } from "react";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { logInteraction } from "@/lib/dev-log";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { api } from "../../../convex/_generated/api";

interface TutorialActionsSectionProps {
  busyAction: string | null;
  onReplayMainTour: () => void;
  onReplaySearchTour: () => void;
}

const RESETTABLE_HINTS = Object.values(FEATURE_HINTS);

export function TutorialActionsSection({
  busyAction,
  onReplayMainTour,
  onReplaySearchTour,
}: TutorialActionsSectionProps) {
  const resetHint = useMutation(api.onboarding.resetHint);
  const [isResettingHints, setIsResettingHints] = useState(false);

  const disabled = busyAction !== null || isResettingHints;

  const handleResetHints = async () => {
    setIsResettingHints(true);
    try {
      await Promise.all(
        RESETTABLE_HINTS.map((hintId) => resetHint({ hintId })),
      );
      logInteraction("settings", "feature-hints-reset", {
        count: RESETTABLE_HINTS.length,
      });
    } finally {
      setIsResettingHints(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Tutorials & feature hints</h2>
        <p className="text-xs text-muted-foreground">
          Replay the guided tours, or reset the contextual hints that appear as
          your library grows.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onReplayMainTour}
          disabled={disabled}
        >
          Replay first-run tour
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReplaySearchTour}
          disabled={disabled}
        >
          Replay advanced search tour
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleResetHints}
          disabled={disabled}
        >
          {isResettingHints ? "Resetting..." : "Reset feature hints"}
        </Button>
      </div>
    </section>
  );
}
