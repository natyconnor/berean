import { useState } from "react";
import { useLiveNow } from "@/hooks/use-live-now";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemoryDashboard } from "./dashboard/dashboard";
import { MemoryLibrary } from "./memory-library";
import { ReviewPlayer } from "./review-player";

/**
 * Memory home: the verse-memory experience surfaced at `/memory`. Leads with the
 * progress dashboard (whose "Today" hero exposes the Review action) and the
 * library of every hearted verse. Review is an in-page surface toggled via
 * `isReviewing` — no route — mirroring the old study-hub Today-queue pattern.
 */
export function MemoryHome() {
  // Refreshes on an interval so the due count stays live while the tab is open
  // (verses whose dueAt lands after mount get counted). Passed as a query arg;
  // never Date.now() inside Convex.
  const now = useLiveNow();
  const [isReviewing, setIsReviewing] = useState(false);

  if (isReviewing) {
    return <ReviewPlayer onExit={() => setIsReviewing(false)} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and grow your hearted verses
          </p>
        </div>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-8">
          <MemoryDashboard
            now={now}
            onStartReview={() => setIsReviewing(true)}
          />
          <MemoryLibrary now={now} />
        </div>
      </ScrollArea>
    </div>
  );
}
