import { type JSX, type ReactNode, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveNow } from "@/hooks/use-live-now";

import { api } from "../../../convex/_generated/api";
import type { VerseMemoryCard } from "../study/study-card-model";
import { StudyActivityDeck } from "../study/study-activity-deck";
import { ReviewSummary } from "./review-summary";
import { StudyVerseLearn } from "../study/study-verse-learn";

/** A single row from `verseMemory.dueQueue` (memory row joined to its ref). */
type DueItem = FunctionReturnType<typeof api.verseMemory.dueQueue>[number];

type Phase = "learn" | "review" | "summary";

interface ReviewPlayerProps {
  /** Return to the memory home. */
  onExit: () => void;
}

function isLearnStatus(status: DueItem["status"]): boolean {
  return status === "new" || status === "learning";
}

/** Map a due-queue row into the verse-memory card shape the deck/learn expect. */
function toCard(item: DueItem): VerseMemoryCard {
  return {
    type: "verse-memory",
    id: `vm:${item._id}`,
    reference: {
      book: item.book,
      chapter: item.chapter,
      startVerse: item.startVerse,
      endVerse: item.endVerse,
    },
  };
}

/**
 * Orchestrates the global Review: the due queue across every hearted
 * verse, played through the existing learn ladder (new/learning verses) and
 * the deck (reviewing/mastered verses), ending in a summary.
 *
 * The due list is snapshotted on entry so cards don't vanish mid-session as
 * `recordAttempt` reschedules verses out of the live due set. The live query is
 * still observed to detect when the review phase is finished and to compute the
 * end-of-run summary (verses cleared, stage-ups, verses still due).
 */
export function ReviewPlayer({ onExit }: ReviewPlayerProps): JSX.Element {
  // Live `now` (coarse, ~60s) so late-due verses are reflected while the run is
  // open. Passed as a query arg; never Date.now() inside Convex.
  const now = useLiveNow();
  const dueItems = useQuery(api.verseMemory.dueQueue, { now });
  // `dueQueue` is capped (<=50 rows); `memoryStats.due` counts *all* due verses,
  // so it — not the capped queue length — is the true remaining total.
  const stats = useQuery(api.verseMemory.memoryStats, { now });

  const [snapshot, setSnapshot] = useState<DueItem[] | null>(null);
  if (dueItems !== undefined && snapshot === null) {
    setSnapshot(dueItems);
  }

  const learnItems = useMemo(
    () => snapshot?.filter((it) => isLearnStatus(it.status)) ?? [],
    [snapshot],
  );
  const reviewItems = useMemo(
    () => snapshot?.filter((it) => !isLearnStatus(it.status)) ?? [],
    [snapshot],
  );

  const [phase, setPhase] = useState<Phase | null>(null);
  const [learnIndex, setLearnIndex] = useState(0);

  // Pick the starting phase once the snapshot resolves, computed during render
  // (not in an effect) so it commits before paint. Empty snapshots fall through
  // to the caught-up state below.
  if (snapshot !== null && snapshot.length > 0 && phase === null) {
    setPhase(
      learnItems.length > 0
        ? "learn"
        : reviewItems.length > 0
          ? "review"
          : "summary",
    );
  }

  const liveDue = useMemo(() => dueItems ?? [], [dueItems]);
  const liveDueRefIds = useMemo(
    () => new Set(liveDue.map((it) => it.verseRefId)),
    [liveDue],
  );
  const liveByRef = useMemo(() => {
    const map = new Map<DueItem["verseRefId"], DueItem>();
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
    let stageUps = 0;
    for (const it of snapshot ?? []) {
      const live = liveByRef.get(it.verseRefId);
      if (!live) {
        // No longer due: rescheduled into the future by a graded attempt.
        cleared += 1;
      } else if (live.learnStage > it.learnStage) {
        stageUps += 1;
      }
    }
    return {
      cleared,
      stageUps,
      reviewed: cleared + stageUps,
      // True outstanding count across *all* due verses (uncapped), falling back
      // to the queue length only until stats resolve.
      remaining: stats?.due ?? liveDue.length,
    };
  }, [snapshot, liveByRef, liveDue.length, stats?.due]);

  function advanceLearn() {
    if (learnIndex + 1 < learnItems.length) {
      setLearnIndex(learnIndex + 1);
    } else if (reviewItems.length > 0) {
      setPhase("review");
    } else {
      setPhase("summary");
    }
  }

  function handleContinue() {
    // Re-run against whatever is still due right now.
    setSnapshot(liveDue);
    setLearnIndex(0);
    setPhase(null);
  }

  // Loading / empty states.
  if (dueItems === undefined || snapshot === null || effectivePhase === null) {
    const caughtUp = snapshot !== null && snapshot.length === 0;
    return (
      <TodayQueueShell onExit={onExit}>
        {caughtUp ? <CaughtUp onExit={onExit} /> : <LoadingState />}
      </TodayQueueShell>
    );
  }

  if (effectivePhase === "summary") {
    return (
      <TodayQueueShell onExit={onExit}>
        <ReviewSummary
          reviewed={summary.reviewed}
          cleared={summary.cleared}
          stageUps={summary.stageUps}
          remaining={summary.remaining}
          onDone={onExit}
          onContinue={summary.remaining > 0 ? handleContinue : undefined}
        />
      </TodayQueueShell>
    );
  }

  if (effectivePhase === "review") {
    const reviewCards = reviewItems.map(toCard);
    return (
      <TodayQueueShell onExit={onExit}>
        <div className="space-y-4">
          <StudyActivityDeck
            key="today-review"
            cards={reviewCards}
            scopeLabel="review"
          />
          <div className="mx-auto flex w-full max-w-2xl justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPhase("summary")}
            >
              End review
            </Button>
          </div>
        </div>
      </TodayQueueShell>
    );
  }

  // Learn phase.
  const learnItem = learnItems[Math.min(learnIndex, learnItems.length - 1)];
  const learnCard = toCard(learnItem);
  const isLastLearn = learnIndex + 1 >= learnItems.length;
  const nextLabel = !isLastLearn
    ? "Next verse"
    : reviewItems.length > 0
      ? "Continue to review"
      : "Finish";

  return (
    <TodayQueueShell onExit={onExit}>
      <div className="space-y-4">
        <StudyVerseLearn key={learnCard.id} card={learnCard} />
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Verse {learnIndex + 1} of {learnItems.length} to learn
          </span>
          <Button onClick={advanceLearn} className="gap-1.5">
            {nextLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </TodayQueueShell>
  );
}

function TodayQueueShell({
  onExit,
  children,
}: {
  onExit: () => void;
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
            Memory
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Review</h1>
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

function CaughtUp({ onExit }: { onExit: () => void }): JSX.Element {
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
        Back to memory
      </Button>
    </div>
  );
}
