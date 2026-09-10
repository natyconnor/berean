import { useState, type JSX } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";
import { Loader2 } from "lucide-react";

import { PassageSession } from "@/components/memory/passage/passage-session";
import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { MemoryAllSessionPage } from "@/components/routes/memory-practice-page";
import { useLiveNow } from "@/hooks/use-live-now";
import { hasLearnVerseScope } from "@/lib/memory-learn-search";
import { isMemorySessionCandidate } from "@/lib/memory-session";
import { sortSessionVerses } from "@/lib/memory-session-order";
import { Route } from "@/routes/memory/learn";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryLearnPage() {
  const search = Route.useSearch();

  if (hasLearnVerseScope(search)) {
    return <MemoryAllSessionPage kind="learning" search={search} />;
  }

  return <GlobalMemoryLearnPage />;
}

function GlobalMemoryLearnPage(): JSX.Element {
  const navigate = useNavigate();
  const now = useLiveNow();
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const savedVerses = useQuery(api.savedVerses.listAll, {});
  const duePassages = useQuery(api.passageMemory.dueForLearning, {
    now,
    tzOffsetMinutes,
  });

  if (savedVerses === undefined || duePassages === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const verses = learningVersesFromSaved(savedVerses, now);

  return (
    <GlobalLearnSession
      passages={duePassages}
      verses={verses}
      onExitHome={() => void navigate({ to: "/memory" })}
    />
  );
}

function GlobalLearnSession({
  passages,
  verses,
  onExitHome,
}: {
  passages: ReadonlyArray<{ packId: Id<"packs">; packName: string }>;
  verses: PracticeVerse[];
  onExitHome: () => void;
}): JSX.Element {
  const [frozenPassages] = useState(passages);
  const [frozenVerses] = useState(verses);
  const [passageIndex, setPassageIndex] = useState(0);

  const current = frozenPassages[passageIndex];
  if (current) {
    return (
      <BuildingPassageLearnCard
        packId={current.packId}
        packName={current.packName}
        onDone={() => setPassageIndex((index) => index + 1)}
      />
    );
  }

  if (frozenVerses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-base font-semibold tracking-tight">
            Nothing to learn right now
          </h1>
          <p className="text-sm text-muted-foreground">
            Start a verse from your library, or come back when an in-progress
            verse or passage is ready.
          </p>
          <Link
            to="/memory"
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            Back to Memory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MemorySessionRunner
      kind="learning"
      verses={frozenVerses}
      scopeLabel="Today's learning"
      onExit={onExitHome}
      emptyState={
        <div className="flex h-full items-center justify-center bg-background px-6">
          <div className="max-w-sm space-y-3 text-center">
            <h1 className="text-base font-semibold tracking-tight">
              Nothing to learn right now
            </h1>
            <p className="text-sm text-muted-foreground">
              Start a verse from your library, or come back when an in-progress
              verse is ready.
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

function BuildingPassageLearnCard({
  packId,
  packName,
  onDone,
}: {
  packId: Id<"packs">;
  packName: string;
  onDone: () => void;
}): JSX.Element {
  const now = useLiveNow();
  const view = useQuery(api.passageMemory.getForPack, {
    packId,
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
  });

  if (view === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (view === null) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-base font-semibold tracking-tight">
            Passage not found
          </h1>
          <button
            type="button"
            className="inline-flex text-sm font-medium text-primary hover:underline"
            onClick={onDone}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <PassageSession
      packId={packId}
      view={view}
      packName={packName}
      onExit={onDone}
      exitTooltip="Continue learning"
    />
  );
}

function learningVersesFromSaved(
  savedVerses: ReadonlyArray<{
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
    memory?: {
      learnStage?: number;
      stageReps?: number;
      status?: PracticeVerse["status"];
      dueAt?: number;
      lastReviewedAt?: number;
    } | null;
  }>,
  now: number,
): PracticeVerse[] {
  return sortSessionVerses(
    savedVerses.flatMap((verse) => {
      if (
        !isMemorySessionCandidate(
          {
            status: verse.memory?.status,
            dueAt: verse.memory?.dueAt,
            lastReviewedAt: verse.memory?.lastReviewedAt,
          },
          "learning",
          now,
          false,
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
          lastReviewedAt: verse.memory?.lastReviewedAt,
        },
      ];
    }),
  );
}
