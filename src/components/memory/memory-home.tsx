import { useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveNow } from "@/hooks/use-live-now";

import { api } from "../../../convex/_generated/api";
import { MemoryDashboard } from "./dashboard/dashboard";
import { MemoryLibrary } from "./memory-library";
import { PackList } from "./packs/pack-list";
import { PracticeBoard, type PracticeVerse } from "./practice/practice-board";
import { ReviewPlayer } from "./review-player";

/**
 * Memory home: the verse-memory experience surfaced at `/memory`. Leads with the
 * progress dashboard (whose "Today" hero exposes the Review action) and the
 * library of every hearted verse. Review and Practice are in-page surfaces
 * toggled via `isReviewing` / `isPracticing` — no routes — mirroring the old
 * study-hub Today-queue pattern.
 */
export function MemoryHome() {
  // Refreshes on an interval so the due count stays live while the tab is open
  // (verses whose dueAt lands after mount get counted). Passed as a query arg;
  // never Date.now() inside Convex.
  const now = useLiveNow();
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);

  // v1 practice set: every hearted verse. Pack-specific entry points come in a
  // later PR. Shares the cached `savedVerses.listAll` subscription with the
  // attempt-recorder so there's no duplicate round trip.
  const savedVerses = useQuery(api.savedVerses.listAll, {});
  const practiceVerses = useMemo<PracticeVerse[]>(
    () =>
      (savedVerses ?? []).map((verse) => ({
        reference: {
          book: verse.book,
          chapter: verse.chapter,
          startVerse: verse.startVerse,
          endVerse: verse.endVerse,
        },
        learnStage: verse.memory?.learnStage ?? 0,
        stageReps: verse.memory?.stageReps ?? 0,
        status: verse.memory?.status,
      })),
    [savedVerses],
  );
  const canPractice = practiceVerses.length > 0;

  if (isReviewing) {
    return <ReviewPlayer onExit={() => setIsReviewing(false)} />;
  }

  if (isPracticing) {
    return (
      <PracticeBoard
        verses={practiceVerses}
        onExit={() => setIsPracticing(false)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Memory</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review and grow your hearted verses
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsPracticing(true)}
            disabled={!canPractice}
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Practice
          </Button>
        </div>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-8">
          <MemoryDashboard
            now={now}
            onStartReview={() => setIsReviewing(true)}
          />
          <PackList now={now} />
          <MemoryLibrary now={now} />
        </div>
      </ScrollArea>
    </div>
  );
}
