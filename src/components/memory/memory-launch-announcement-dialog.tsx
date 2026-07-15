import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";

import { FeatureInfoDialog } from "@/components/tutorial/feature-info-dialog";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import {
  FEATURE_HINTS,
  MEMORY_LAUNCH_ANNOUNCEMENT_AFTER,
} from "@/lib/feature-hints";
import { shouldRevealMemory } from "@/lib/staged-onboarding-thresholds";
import { api } from "../../../convex/_generated/api";

/**
 * One-time launch modal for the Memory overhaul + Mode Dock. Shown only to
 * accounts created before the launch cutoff (existing users), after the main
 * tour is done, so new signups get the normal first-heart / first-open flow.
 *
 * Most existing users have never hearted a verse, so the copy leads with
 * hearting to unlock Memory. Users who already have hearts get an Explore CTA.
 */
export function MemoryLaunchAnnouncementDialog() {
  const navigate = useNavigate();
  const status = useQuery(api.onboarding.getOnboardingStatus);

  const trigger =
    status !== undefined &&
    status.accountCreatedAt > 0 &&
    status.accountCreatedAt < MEMORY_LAUNCH_ANNOUNCEMENT_AFTER &&
    status.mainTutorialCompletedAt !== undefined;

  const memoryUnlocked =
    status !== undefined && shouldRevealMemory(status.milestones);

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
      description="Heart a verse in the reader to unlock the Memory page — then practice, review, and build packs to store up verses over time."
      body={
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Tap the heart beside any verse to unlock Memory in the floating bar
            at the bottom of the screen.
          </li>
          <li>Practice and review to master verses over time.</li>
          <li>Build packs by theme or passage to focus your work.</li>
          <li>
            Once unlocked, switch modes from the bar — or with Cmd/Ctrl+J.
          </li>
        </ul>
      }
      primaryActionLabel={memoryUnlocked ? "Explore Memory" : undefined}
      onPrimaryAction={
        memoryUnlocked
          ? () => {
              void navigate({ to: "/memory" });
            }
          : undefined
      }
    />
  );
}
