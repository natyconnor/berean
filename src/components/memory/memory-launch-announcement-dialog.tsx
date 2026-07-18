import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";

import { FeatureInfoDialog } from "@/components/tutorial/feature-info-dialog";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import {
  FEATURE_HINTS,
  MEMORY_LAUNCH_ANNOUNCEMENT_AFTER,
} from "@/lib/feature-hints";
import { api } from "../../../convex/_generated/api";

/**
 * One-time launch modal for the Memory overhaul + Mode Dock. Shown only to
 * accounts created before the launch cutoff (existing users), after the main
 * tour is done, so new signups get the normal dock callout / first-open flow.
 */
export function MemoryLaunchAnnouncementDialog() {
  const navigate = useNavigate();
  const status = useQuery(api.onboarding.getOnboardingStatus);

  const trigger =
    status !== undefined &&
    status.accountCreatedAt > 0 &&
    status.accountCreatedAt < MEMORY_LAUNCH_ANNOUNCEMENT_AFTER &&
    status.mainTutorialCompletedAt !== undefined;

  const hint = useFeatureHint(
    FEATURE_HINTS.MEMORY_LAUNCH_ANNOUNCEMENT,
    trigger,
    {
      useDisplayQueue: false,
    },
  );

  return (
    <FeatureInfoDialog
      state={hint}
      title="Memory is here"
      description="Practice, review, and build packs to store up verses over time — open Memory anytime from the floating bar at the bottom of the screen."
      body={
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Switch to Memory from the floating bar, or with Cmd/Ctrl+J.</li>
          <li>Heart verses in the reader to add them to Memory.</li>
          <li>Practice and review to master verses over time.</li>
          <li>Build packs by theme or passage to focus your work.</li>
        </ul>
      }
      primaryActionLabel="Explore Memory"
      onPrimaryAction={() => {
        void navigate({ to: "/memory" });
      }}
    />
  );
}
