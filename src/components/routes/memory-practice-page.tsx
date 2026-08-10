import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";
import { Loader2 } from "lucide-react";

import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  hasPracticeVerseScope,
  type MemoryPracticeSearch,
} from "@/lib/memory-practice-search";
import {
  isMemorySessionCandidate,
  type MemorySessionKind,
} from "@/lib/memory-session";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/practice";

import { api } from "../../../convex/_generated/api";

export function MemoryPracticePage() {
  const search = Route.useSearch();

  return <MemoryAllSessionPage kind="practice" search={search} />;
}

export function MemoryAllSessionPage({
  kind,
  search,
}: {
  kind: MemorySessionKind;
  search: MemoryPracticeSearch;
}) {
  const navigate = useNavigate();
  const savedVerses = useQuery(api.savedVerses.listAll, {});
  const now = useLiveNow();

  const verses = useMemo(
    () => scopeMemorySessionVerses(savedVerses, search, kind, now),
    [savedVerses, search, kind, now],
  );
  const scopeLabel = hasPracticeVerseScope(search)
    ? formatVerseRef(search)
    : kind === "learning"
      ? "Today's learning"
      : "All learned verses";
  const isLearning = kind === "learning";

  if (savedVerses === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MemorySessionRunner
      kind={kind}
      verses={verses}
      scopeLabel={scopeLabel}
      onExit={() => void navigate({ to: "/memory" })}
      emptyState={
        <div className="flex h-full items-center justify-center bg-background px-6">
          <div className="max-w-sm space-y-3 text-center">
            <h1 className="text-base font-semibold tracking-tight">
              {isLearning
                ? "Nothing to learn right now"
                : "Nothing to practice"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLearning
                ? "Start a verse from your library, or come back when an in-progress verse is ready."
                : "Verses become available for extra practice after they finish Learning."}
            </p>
            <Link
              to="/memory"
              className="inline-flex text-sm font-medium text-primary hover:underline"
            >
              Back to Memory
            </Link>
          </div>
        </div>
      }
    />
  );
}

function scopeMemorySessionVerses(
  savedVerses:
    | ReadonlyArray<{
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
        memory?: {
          learnStage?: number;
          stageReps?: number;
          status?: PracticeVerse["status"];
          dueAt?: number;
        } | null;
      }>
    | undefined,
  search: MemoryPracticeSearch,
  kind: MemorySessionKind,
  now: number,
): PracticeVerse[] {
  if (savedVerses === undefined) return [];

  const scoped = hasPracticeVerseScope(search);
  return savedVerses.flatMap((verse) => {
    if (
      scoped &&
      !(
        verse.book === search.book &&
        verse.chapter === search.chapter &&
        verse.startVerse === search.startVerse &&
        verse.endVerse === search.endVerse
      )
    ) {
      return [];
    }

    if (
      !isMemorySessionCandidate(
        {
          status: verse.memory?.status,
          dueAt: verse.memory?.dueAt,
        },
        kind,
        now,
        scoped,
      )
    ) {
      return [];
    }

    return [
      {
        reference: {
          book: verse.book,
          chapter: verse.chapter,
          startVerse: verse.startVerse,
          endVerse: verse.endVerse,
        },
        learnStage: verse.memory?.learnStage ?? 0,
        stageReps: verse.memory?.stageReps ?? 0,
        status: verse.memory?.status,
        dueAt: verse.memory?.dueAt,
      },
    ];
  });
}
