import { useMemo, useState } from "react";
import { Loader2, Clock3, Sparkles } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { dueQueueEntryToPracticeVerse } from "@/components/memory/to-practice-verse";
import { Button } from "@/components/ui/button";
import { useFrozenQuery } from "@/hooks/use-frozen-query";
import { useLiveNow } from "@/hooks/use-live-now";
import { useMemoryBack } from "@/hooks/use-memory-back";
import { hasReviewVerseScope } from "@/lib/memory-review-search";
import { remainingDueAfterQueue } from "@/lib/memory-session";
import { sortSessionVerses } from "@/lib/memory-session-order";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/review";

function dueRowToPracticeVerse(
  row: Parameters<typeof dueQueueEntryToPracticeVerse>[0],
): PracticeVerse {
  return dueQueueEntryToPracticeVerse(row);
}

function ReviewCaughtUp({
  onExit,
  doneLabel = "Back to memory",
}: {
  onExit: () => void;
  doneLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">All caught up</h1>
        <p className="text-sm text-muted-foreground">
          No verses are due for review right now. Check back later.
        </p>
      </div>
      <Button variant="outline" onClick={onExit}>
        {doneLabel}
      </Button>
    </div>
  );
}

function MemoryReviewSessionPage({
  verses,
  scopeLabel,
  remainingDue,
  onExit,
  exitLabel = "Back to memory",
  onContinueSession,
}: {
  verses: ReadonlyArray<PracticeVerse>;
  scopeLabel: string;
  remainingDue: number;
  onExit: () => void;
  exitLabel?: string;
  onContinueSession?: () => void;
}) {
  return (
    <MemorySessionRunner
      kind="review"
      verses={verses}
      scopeLabel={scopeLabel}
      onExit={onExit}
      exitLabel={exitLabel}
      remainingDue={remainingDue}
      onContinueSession={onContinueSession}
      emptyState={<ReviewCaughtUp onExit={onExit} doneLabel={exitLabel} />}
    />
  );
}

export function MemoryReviewPage() {
  const onExit = useMemoryBack();
  const search = Route.useSearch();
  const now = useLiveNow();
  const hasScope = hasReviewVerseScope(search);
  const [queueEpoch, setQueueEpoch] = useState(0);
  const [drainedDue, setDrainedDue] = useState(0);

  const scopedDue = useFrozenQuery(
    api.verseMemory.dueForVerse,
    hasScope
      ? {
          now,
          book: search.book,
          chapter: search.chapter,
          startVerse: search.startVerse,
          endVerse: search.endVerse,
        }
      : "skip",
  );
  const globalDue = useFrozenQuery(
    api.verseMemory.dueQueue,
    hasScope ? "skip" : { now, generation: queueEpoch },
    queueEpoch,
  );
  const globalStats = useFrozenQuery(
    api.verseMemory.memoryStats,
    hasScope
      ? "skip"
      : { now, tzOffsetMinutes: new Date(now).getTimezoneOffset() },
  );

  const globalVerses = useMemo(
    () => sortSessionVerses((globalDue ?? []).map(dueRowToPracticeVerse)),
    [globalDue],
  );
  const remainingDue = hasScope
    ? 0
    : remainingDueAfterQueue(
        (globalStats?.due ?? 0) - drainedDue,
        globalVerses.length,
      );

  if (!hasScope) {
    if (globalDue === undefined || globalStats === undefined) {
      return (
        <div className="flex h-full items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <MemoryReviewSessionPage
        key={`review-${queueEpoch}`}
        verses={globalVerses}
        scopeLabel="All due today"
        remainingDue={remainingDue}
        onExit={onExit}
        onContinueSession={() => {
          setDrainedDue((value) => value + globalVerses.length);
          setQueueEpoch((value) => value + 1);
        }}
      />
    );
  }

  if (scopedDue === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scopedDue === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Clock3 className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="max-w-sm space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Not ready to review
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatVerseRef(search)} isn&apos;t in review yet. Learn it first,
            then come back for a one-off review anytime.
          </p>
        </div>
        <Button variant="outline" onClick={onExit}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <MemoryReviewSessionPage
      verses={[dueRowToPracticeVerse(scopedDue)]}
      scopeLabel={formatVerseRef(search)}
      remainingDue={0}
      onExit={onExit}
    />
  );
}
