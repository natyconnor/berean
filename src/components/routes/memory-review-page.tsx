import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Clock3, Loader2, Sparkles } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { hasReviewVerseScope } from "@/lib/memory-review-search";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/review";

function dueRowToPracticeVerse(row: {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  learnStage: number;
  stageReps?: number;
  status: PracticeVerse["status"];
  dueAt: number;
  lastReviewedAt?: number;
}): PracticeVerse {
  return {
    reference: {
      book: row.book,
      chapter: row.chapter,
      startVerse: row.startVerse,
      endVerse: row.endVerse,
    },
    learnStage: row.learnStage,
    stageReps: row.stageReps,
    status: row.status,
    dueAt: row.dueAt,
    lastReviewedAt: row.lastReviewedAt,
  };
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
}: {
  verses: ReadonlyArray<PracticeVerse>;
  scopeLabel: string;
  remainingDue: number;
  onExit: () => void;
  exitLabel?: string;
}) {
  const [sessionEpoch, setSessionEpoch] = useState(0);

  return (
    <MemorySessionRunner
      key={`review-${sessionEpoch}`}
      kind="review"
      verses={verses}
      scopeLabel={scopeLabel}
      onExit={onExit}
      exitLabel={exitLabel}
      remainingDue={remainingDue}
      onContinueSession={() => setSessionEpoch((value) => value + 1)}
      emptyState={<ReviewCaughtUp onExit={onExit} doneLabel={exitLabel} />}
    />
  );
}

export function MemoryReviewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const now = useLiveNow();
  const hasScope = hasReviewVerseScope(search);
  const scopedDue = useQuery(
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
  const globalDue = useQuery(
    api.verseMemory.dueQueue,
    hasScope ? "skip" : { now },
  );
  const globalStats = useQuery(
    api.verseMemory.memoryStats,
    hasScope ? "skip" : { now },
  );

  // Freeze the scoped due row once it first resolves so Check → reschedule
  // doesn't bounce this page to "Not due yet" mid-session.
  const [scopedSnapshot, setScopedSnapshot] = useState<
    ReturnType<typeof dueRowToPracticeVerse> | null | undefined
  >(undefined);
  if (hasScope && scopedDue !== undefined && scopedSnapshot === undefined) {
    setScopedSnapshot(
      scopedDue === null ? null : dueRowToPracticeVerse(scopedDue),
    );
  }

  const globalVerses = useMemo(
    () => (globalDue ?? []).map(dueRowToPracticeVerse),
    [globalDue],
  );
  const remainingDue = hasScope
    ? scopedSnapshot === null
      ? 0
      : 1
    : (globalStats?.due ?? globalVerses.length);

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
        verses={globalVerses}
        scopeLabel="All due today"
        remainingDue={remainingDue}
        onExit={() => void navigate({ to: "/memory" })}
      />
    );
  }

  if (scopedSnapshot === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scopedSnapshot === null) {
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
        <Button
          variant="outline"
          onClick={() => void navigate({ to: "/memory" })}
        >
          Back to memory
        </Button>
      </div>
    );
  }

  return (
    <MemoryReviewSessionPage
      verses={[scopedSnapshot]}
      scopeLabel={formatVerseRef(search)}
      remainingDue={0}
      onExit={() => void navigate({ to: "/memory" })}
    />
  );
}
