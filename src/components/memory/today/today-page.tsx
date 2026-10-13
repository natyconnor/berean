import { useRef } from "react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { PreviewMemorySeedCard } from "@/components/memory/preview-memory-seed-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveNow } from "@/hooks/use-live-now";
import { useTodayModel } from "@/hooks/use-today-model";
import { isPreviewTestToolsEnabled } from "@/lib/preview-test-tools";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

import { DoorwayCards } from "./doorway-cards";
import { FirstRun } from "./first-run";
import { GoalGrid } from "./goal-grid";
import { StartSomethingNew } from "./start-something-new";
import { TodayCard } from "./today-card";

/**
 * `/memory`: Today, the one Memory home. The Today card with its one primary
 * button, the Your progress / Your verses doorways, what you're memorizing,
 * and ways to start something new. Someone with nothing in Memory gets the
 * first-run invitation instead.
 */
export function TodayPage() {
  // Shared session clock with the dock badge; passed to Convex as an arg.
  const now = useLiveNow();
  const timeZone = getViewerTimeZone();
  const today = useTodayModel(now);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const previewTools = isPreviewTestToolsEnabled();
  const status = useQuery(
    api.verseMemory.memoryStatus,
    previewTools ? {} : "skip",
  );

  let body;
  if (today === undefined) {
    body = <TodaySkeleton />;
  } else if (today.state === "firstRun") {
    body = <FirstRun scrollRootRef={scrollRootRef} />;
  } else {
    body = (
      <>
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] md:gap-3">
          <TodayCard today={today} now={now} timeZone={timeZone} />
          <DoorwayCards today={today} now={now} />
        </div>
        <GoalGrid goals={today.goals} now={now} timeZone={timeZone} />
        <StartSomethingNew scrollRootRef={scrollRootRef} />
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-4 py-4 sm:px-5">
        <h1 className="text-lg font-semibold tracking-tight">Memory</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Review verses and passages, or start something new
        </p>
      </header>
      <ScrollArea className="min-h-0 flex-1" viewportRef={scrollRootRef}>
        <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 pb-24 sm:px-5">
          {body}
          <PreviewMemorySeedCard
            now={now}
            heartedTotal={status?.total}
            enabled={previewTools}
            autoSeed={Boolean(__IS_PREVIEW__)}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading Today" className="space-y-8">
      <div
        aria-hidden
        className="grid gap-2.5 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] md:gap-3"
      >
        <div className="h-44 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-1">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
      <div aria-hidden className="grid gap-3 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
