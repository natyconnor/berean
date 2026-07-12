import { Dumbbell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveNow } from "@/hooks/use-live-now";
import { memoryPracticeSearch } from "@/lib/memory-practice-search";
import { memoryReviewSearch } from "@/lib/memory-review-search";

import { api } from "../../../convex/_generated/api";
import { MemoryDashboard } from "./dashboard/dashboard";
import { MemoryLibrary } from "./memory-library";
import { PackList } from "./packs/pack-list";

/**
 * Memory home: the verse-memory experience surfaced at `/memory`. Leads with the
 * progress dashboard (whose "Today" hero exposes the Review action) and the
 * library of every hearted verse. Review and Practice live on their own routes
 * (`/memory/review`, `/memory/practice`) so reloads and back/forward keep you
 * in-session.
 */
export function MemoryHome() {
  // Refreshes on an interval so the due count stays live while the tab is open
  // (verses whose dueAt lands after mount get counted). Passed as a query arg;
  // never Date.now() inside Convex.
  const now = useLiveNow();
  const navigate = useNavigate();

  const stats = useQuery(api.verseMemory.memoryStats, { now });
  const canPractice = (stats?.total ?? 0) > 0;

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
            onClick={() =>
              void navigate({ to: "/memory/practice", search: {} })
            }
            disabled={!canPractice}
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Practice All
          </Button>
        </div>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto max-w-6xl space-y-8 px-5 py-6">
          <MemoryDashboard
            now={now}
            stats={stats}
            onStartReview={() => void navigate({ to: "/memory/review" })}
          />
          {/* Library is the main column; Packs sits as a sidebar on large
              screens. Explicit col/row placement keeps Packs first in DOM order
              (so it stacks on top on mobile) while rendering on the right at lg. */}
          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
            <div className="lg:col-start-3 lg:row-start-1">
              <PackList now={now} />
            </div>
            <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
              <MemoryLibrary
                now={now}
                onPracticeVerse={(verse) => {
                  void navigate({
                    to: "/memory/practice",
                    search: memoryPracticeSearch(verse.reference),
                  });
                }}
                onReviewVerse={(verse) => {
                  void navigate({
                    to: "/memory/review",
                    search: memoryReviewSearch(verse.reference),
                  });
                }}
              />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
