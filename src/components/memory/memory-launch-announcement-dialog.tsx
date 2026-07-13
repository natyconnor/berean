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
 * tour is done, so new signups get the normal first-heart / first-open flow.
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
      description="Store up your hearted verses and carry them with you — with practice, review, and packs to help you master them over time."
      body={
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Heart a verse to save it for Memory.</li>
          <li>Practice and review to lock verses in over time.</li>
          <li>Build packs by theme or passage to focus your work.</li>
          <li>
            Find Notes, Memory, and Study in the floating bar at the bottom of
            the screen — switch there, or with Cmd/Ctrl+J.
          </li>
        </ul>
      }
      primaryActionLabel="Explore Memory"
      onPrimaryAction={() => {
        void navigate({ to: "/memory" });
      }}
    />
  );
}
