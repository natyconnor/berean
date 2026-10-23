import { useState, type JSX } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { Loader2 } from "lucide-react";

import { PassageSession } from "@/components/memory/passage/passage-session";
import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { AllLearnEmptyState } from "@/components/memory/session-empty-states";
import { toPracticeVerse } from "@/components/memory/to-practice-verse";
import { MemoryAllSessionPage } from "@/components/routes/memory-practice-page";
import { useFrozenQuery } from "@/hooks/use-frozen-query";
import { useLiveNow } from "@/hooks/use-live-now";
import { useMemoryExit } from "@/hooks/use-memory-back";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
  readLearnPacksDismissedToday,
} from "@/lib/learn-dismissed-packs";
import { hasLearnVerseScope } from "@/lib/memory-learn-search";
import { hasMemorizedVerses } from "@/lib/memory-session";
import { Route } from "@/routes/memory/learn";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryLearnPage() {
  const search = Route.useSearch();

  if (hasLearnVerseScope(search)) {
    return <MemoryAllSessionPage kind="learning" search={search} />;
  }

  return <GlobalMemoryLearnPage returnTo={search.return} />;
}

function GlobalMemoryLearnPage({
  returnTo,
}: {
  returnTo: string | undefined;
}): JSX.Element {
  const exit = useMemoryExit(returnTo);
  const onExitHome = exit.go;
  const backLabel = exit.label;
  const now = useLiveNow();
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const learnQueue = useFrozenQuery(api.verseMemory.learnQueue, {
    now,
    tzOffsetMinutes,
  });
  const duePassages = useFrozenQuery(api.passageMemory.dueForLearning, {
    now,
    tzOffsetMinutes,
  });
  const stats = useFrozenQuery(api.verseMemory.memoryStats, {
    now,
    tzOffsetMinutes,
  });

  if (learnQueue === undefined || duePassages === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const verses = learnQueue.map((item) =>
    toPracticeVerse({
      verseRefId: item.verseRefId,
      book: item.book,
      chapter: item.chapter,
      startVerse: item.startVerse,
      endVerse: item.endVerse,
      ...item.memory,
    }),
  );

  return (
    <GlobalLearnSession
      passages={duePassages}
      verses={verses}
      now={now}
      dayKey={learnDismissDayKey(now)}
      onExitHome={onExitHome}
      backLabel={backLabel}
      exitHref={exit.href}
      returnTo={returnTo}
      hasMemorized={hasMemorizedVerses(stats)}
    />
  );
}

function GlobalLearnSession({
  passages,
  verses,
  now,
  dayKey,
  onExitHome,
  backLabel,
  exitHref,
  returnTo,
  hasMemorized,
}: {
  passages: ReadonlyArray<{ packId: Id<"packs">; packName: string }>;
  verses: PracticeVerse[];
  now: number;
  dayKey: number;
  onExitHome: () => void;
  backLabel: string;
  exitHref: string;
  returnTo: string | undefined;
  hasMemorized: boolean;
}): JSX.Element {
  // Freeze the due list for this visit so a live update cannot swap packs
  // mid-session. Walk every frozen pack: the first one not set aside earlier
  // today is the session. "That's enough for today" records the dismissal and
  // leaves; it does not open the next pack until a later visit.
  const [frozenPassages] = useState(passages);
  const [frozenVerses] = useState(verses);
  const [dismissedPackIds] = useState(() =>
    readLearnPacksDismissedToday(dayKey),
  );

  const passage = frozenPassages.find(
    (item) => !dismissedPackIds.has(item.packId),
  );
  if (passage) {
    const dismissAndLeave = () => {
      dismissLearnPackForToday(passage.packId, dayKey);
      onExitHome();
    };
    return (
      <BuildingPassageLearnCard
        packId={passage.packId}
        packName={passage.packName}
        onExitHome={onExitHome}
        backLabel={backLabel}
        exitHref={exitHref}
        onDismissPack={dismissAndLeave}
      />
    );
  }

  const emptyState = (
    <AllLearnEmptyState
      now={now}
      onExit={onExitHome}
      backLabel={backLabel}
      exitHref={exitHref}
    />
  );

  return (
    <MemorySessionRunner
      kind="learning"
      verses={frozenVerses}
      scopeLabel="Today's learning"
      onExit={onExitHome}
      backLabel={backLabel}
      exitHref={exitHref}
      returnTo={returnTo}
      hasMemorized={hasMemorized}
      emptyState={emptyState}
    />
  );
}

function BuildingPassageLearnCard({
  packId,
  packName,
  onExitHome,
  backLabel,
  exitHref,
  onDismissPack,
}: {
  packId: Id<"packs">;
  packName: string;
  onExitHome: () => void;
  backLabel: string;
  exitHref: string;
  /** "That's enough for today", or Back from a pack this query cannot load. */
  onDismissPack: () => void;
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
            onClick={onDismissPack}
          >
            {backLabel}
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
      onExit={onExitHome}
      onDoneForToday={onDismissPack}
      backLabel={backLabel}
      exitHref={exitHref}
    />
  );
}
