import { type JSX, type ReactNode, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "convex/react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveNow } from "@/hooks/use-live-now";
import type { MemoryStatus } from "@/lib/memory-scheduler";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { VerseMemoryCard } from "../study/study-card-model";
import { StudyActivityDeck } from "../study/study-activity-deck";
import { ReviewSummary } from "./review-summary";

/**
 * The minimal per-verse shape the player needs to sequence a run. Satisfied by
 * both the global `verseMemory.dueQueue` rows and a pack's due members
 * (`packs.resolveMembers`), so the same player can be driven by either source.
 */
export interface ReviewItem {
  verseRefId: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  status: MemoryStatus;
  learnStage: number;
}

/**
 * An explicit due source (e.g. a pack's due members) that overrides the global
 * due queue. `dueItems === undefined` means still loading; `[]` means caught up.
 */
export interface ReviewSource {
  dueItems: ReviewItem[] | undefined;
  remainingDue: number | undefined;
}

type Phase = "review" | "summary";

interface ReviewPlayerProps {
  /** Return to the memory home (or pack view). */
  onExit: () => void;
  /** Header title. Defaults to "Review". */
  title?: string;
  /** Back-button label. Defaults to "Memory". */
  backLabel?: string;
  /** Done button label. Defaults by source. */
  doneLabel?: string;
  /**
   * When provided, drives the run from this reactive due set instead of the
   * global `verseMemory.dueQueue`. Used to play a single pack's due subset.
   */
  source?: ReviewSource;
}

/** Map a due row into the verse-memory card shape the deck expects. */
function toCard(item: ReviewItem): VerseMemoryCard {
  return {
    type: "verse-memory",
    id: `vm:${item.verseRefId}`,
    reference: {
      book: item.book,
      chapter: item.chapter,
      startVerse: item.startVerse,
      endVerse: item.endVerse,
    },
  };
}

/**
 * Orchestrates Review: the due queue of `reviewing` / `mastered` hearted
 * verses, played through the deck, ending in a summary. Learning-phase verses
 * are not part of this queue — they are practiced from verse detail / learn.
 *
 * The due list is snapshotted on entry so cards don't vanish mid-session as
 * `recordAttempt` reschedules verses out of the live due set. The live query is
 * still observed to detect when the review is finished and to compute the
 * end-of-run summary (verses cleared, verses still due).
 */
export function ReviewPlayer({
  onExit,
  title = "Review",
  backLabel = "Memory",
  doneLabel,
  source,
}: ReviewPlayerProps): JSX.Element {
  // Live `now` (coarse, ~60s) so late-due verses are reflected while the run is
  // open. Passed as a query arg; never Date.now() inside Convex.
  const now = useLiveNow();
  // With an explicit `source` (a pack's due subset), skip the global queries and
  // let the caller supply the reactive due list + remaining total instead.
  const globalDue = useQuery(
    api.verseMemory.dueQueue,
    source ? "skip" : { now },
  );
  // `dueQueue` is capped (<=50 rows); `memoryStats.due` counts *all* due review
  // verses, so it — not the capped queue length — is the true remaining total.
  const globalStats = useQuery(
    api.verseMemory.memoryStats,
    source ? "skip" : { now },
  );
  const resolvedDoneLabel =
    doneLabel ?? (source ? "Back to pack" : "Back to memory");
  const dueItems: ReviewItem[] | undefined = source
    ? source.dueItems
    : globalDue;
  const remainingDue: number | undefined = source
    ? source.remainingDue
    : globalStats?.due;

  const [snapshot, setSnapshot] = useState<ReviewItem[] | null>(null);
  if (dueItems !== undefined && snapshot === null) {
    setSnapshot(dueItems);
  }

  const reviewItems = useMemo(() => snapshot ?? [], [snapshot]);

  // Stable across Convex re-renders while the snapshot is frozen — avoids
  // handing StudyActivityDeck a new `cards` array after every recordAttempt.
  const reviewCards = useMemo(() => reviewItems.map(toCard), [reviewItems]);

  const [phase, setPhase] = useState<Phase | null>(null);

  // Pick the starting phase once the snapshot resolves, computed during render
  // (not in an effect) so it commits before paint. Empty snapshots fall through
  // to the caught-up state below.
  if (snapshot !== null && snapshot.length > 0 && phase === null) {
    setPhase("review");
  }

  const liveDue = useMemo(() => dueItems ?? [], [dueItems]);
  const liveDueRefIds = useMemo(
    () => new Set(liveDue.map((it) => it.verseRefId)),
    [liveDue],
  );
  const liveByRef = useMemo(() => {
    const map = new Map<Id<"verseRefs">, ReviewItem>();
    for (const it of liveDue) map.set(it.verseRefId, it);
    return map;
  }, [liveDue]);

  // The review deck is done once none of its verses remain due. Derived rather
  // than committed so we never call setState from an effect.
  const reviewDone =
    phase === "review" &&
    reviewItems.length > 0 &&
    !reviewItems.some((it) => liveDueRefIds.has(it.verseRefId));
  const effectivePhase: Phase | null = reviewDone ? "summary" : phase;

  const summary = useMemo(() => {
    let cleared = 0;
    for (const it of snapshot ?? []) {
      if (!liveByRef.has(it.verseRefId)) {
        // No longer due: rescheduled into the future by a graded attempt.
        cleared += 1;
      }
    }
    return {
      cleared,
      stageUps: 0,
      reviewed: cleared,
      // True outstanding count across *all* due review verses (uncapped),
      // falling back to the queue length only until the remaining total resolves.
      remaining: remainingDue ?? liveDue.length,
    };
  }, [snapshot, liveByRef, liveDue.length, remainingDue]);

  function handleContinue() {
    // Re-run against whatever is still due right now.
    setSnapshot(liveDue);
    setPhase(null);
  }

  // Loading / empty states.
  if (dueItems === undefined || snapshot === null || effectivePhase === null) {
    const caughtUp = snapshot !== null && snapshot.length === 0;
    return (
      <TodayQueueShell onExit={onExit} title={title} backLabel={backLabel}>
        {caughtUp ? (
          <CaughtUp onExit={onExit} doneLabel={resolvedDoneLabel} />
        ) : (
          <LoadingState />
        )}
      </TodayQueueShell>
    );
  }

  if (effectivePhase === "summary") {
    return (
      <TodayQueueShell onExit={onExit} title={title} backLabel={backLabel}>
        <ReviewSummary
          reviewed={summary.reviewed}
          cleared={summary.cleared}
          stageUps={summary.stageUps}
          remaining={summary.remaining}
          onDone={onExit}
          onContinue={summary.remaining > 0 ? handleContinue : undefined}
          doneLabel={resolvedDoneLabel}
        />
      </TodayQueueShell>
    );
  }

  return (
    <TodayQueueShell onExit={onExit} title={title} backLabel={backLabel}>
      <StudyActivityDeck
        key="today-review"
        cards={reviewCards}
        scopeLabel="review"
        interaction="test"
        onEndSession={() => setPhase("summary")}
        endSessionLabel="End review"
      />
    </TodayQueueShell>
  );
}

function TodayQueueShell({
  onExit,
  title,
  backLabel,
  children,
}: {
  onExit: () => void;
  title: string;
  backLabel: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="-ml-2 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-2xl px-5 py-6">{children}</div>
      </ScrollArea>
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function CaughtUp({
  onExit,
  doneLabel,
}: {
  onExit: () => void;
  doneLabel: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">All caught up</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          No verses are due for review right now. Check back later.
        </p>
      </div>
      <Button variant="outline" onClick={onExit}>
        {doneLabel}
      </Button>
    </div>
  );
}
