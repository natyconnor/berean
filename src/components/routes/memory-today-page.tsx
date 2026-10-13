import { type JSX, type ReactNode, useEffect, useRef, useState } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { ArrowLeft, CheckCircle2, Loader2, SearchX } from "lucide-react";

import {
  packLearningSessionVerses,
  packReviewSession,
} from "@/components/memory/pack-session-verses";
import { PassageSession } from "@/components/memory/passage/passage-session";
import { ExtraPracticeLink } from "@/components/memory/practice/extra-practice-link";
import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type {
  PracticeSessionResult,
  PracticeVerse,
} from "@/components/memory/practice/practice-board";
import type { SessionCompleteVerse } from "@/components/memory/practice/session-complete";
import {
  SessionHeaderProgress,
  type SessionProgress,
} from "@/components/memory/practice/session-header-progress";
import { TodaySessionSummary } from "@/components/memory/practice/today-session-summary";
import {
  dueQueueEntryToPracticeVerse,
  toPracticeVerse,
} from "@/components/memory/to-practice-verse";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFrozenQuery } from "@/hooks/use-frozen-query";
import { useLiveNow } from "@/hooks/use-live-now";
import { useMemoryExit, useMemoryExitLabel } from "@/hooks/use-memory-back";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
  readLearnPacksDismissedToday,
} from "@/lib/learn-dismissed-packs";
import { withReturn } from "@/lib/memory-return";
import { isReviewPhase } from "@/lib/memory-scheduler";
import { hasMemorizedVerses } from "@/lib/memory-session";
import { sortSessionVerses } from "@/lib/memory-session-order";
import {
  planTodaySession,
  todayInterstitialCopy,
  todaySegmentHeader,
  todaySessionProgress,
  type TodayPassageInput,
  type TodaySegment,
} from "@/lib/memory-today-session";
import type { ReviewSessionAttempt } from "@/lib/review-session-attempts";
import { Route } from "@/routes/memory/today";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface TodayChrome {
  onExit: () => void;
  backLabel: string;
  returnTo: string | undefined;
}

/** Everything the session runs, frozen when the route opened. */
interface TodaySessionData {
  /** "Today", or the pack's name for one pack's work. */
  title: string;
  passages: readonly TodayPassageInput<Id<"packs">>[];
  learning: readonly PracticeVerse[];
  reviews: readonly PracticeVerse[];
  hasMemorized: boolean;
}

/**
 * `/memory/today`: building passages, then learning verses, then due reviews,
 * with a short pause between parts and one summary at the end. With
 * `?packId=`, only that pack's work today. Done, Stop for today, and Back go
 * to `return`.
 */
export function MemoryTodayPage(): JSX.Element {
  const { packId, return: returnTo } = Route.useSearch();
  const onExit = useMemoryExit(returnTo);
  const backLabel = useMemoryExitLabel(returnTo);
  const chrome: TodayChrome = { onExit, backLabel, returnTo };

  return packId ? (
    <PackTodayLoader packId={packId as Id<"packs">} chrome={chrome} />
  ) : (
    <GlobalTodayLoader chrome={chrome} />
  );
}

function GlobalTodayLoader({ chrome }: { chrome: TodayChrome }): JSX.Element {
  const now = useLiveNow();
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const passages = useFrozenQuery(api.passageMemory.dueForLearning, {
    now,
    tzOffsetMinutes,
  });
  const learnQueue = useFrozenQuery(api.verseMemory.learnQueue, {
    now,
    tzOffsetMinutes,
  });
  const dueQueue = useFrozenQuery(api.verseMemory.dueQueue, { now });
  const stats = useFrozenQuery(api.verseMemory.memoryStats, {
    now,
    tzOffsetMinutes,
  });

  if (
    passages === undefined ||
    learnQueue === undefined ||
    dueQueue === undefined ||
    stats === undefined
  ) {
    return <SessionLoading />;
  }

  const data: TodaySessionData = {
    title: "Today",
    passages,
    learning: learnQueue.map((item) =>
      toPracticeVerse({
        verseRefId: item.verseRefId,
        book: item.book,
        chapter: item.chapter,
        startVerse: item.startVerse,
        endVerse: item.endVerse,
        ...item.memory,
      }),
    ),
    reviews: sortSessionVerses(dueQueue.map(dueQueueEntryToPracticeVerse)),
    hasMemorized: hasMemorizedVerses(stats),
  };
  return (
    <TodaySession
      data={data}
      dayKey={learnDismissDayKey(now)}
      chrome={chrome}
    />
  );
}

function PackTodayLoader({
  packId,
  chrome,
}: {
  packId: Id<"packs">;
  chrome: TodayChrome;
}): JSX.Element {
  const now = useLiveNow();
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const pack = useFrozenQuery(api.packs.get, { id: packId });
  const members = useFrozenQuery(api.packs.resolveMembers, {
    id: packId,
    now,
  });
  const passage = useFrozenQuery(api.passageMemory.getForPack, {
    packId,
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

  if (
    pack === undefined ||
    members === undefined ||
    passage === undefined ||
    duePassages === undefined ||
    stats === undefined
  ) {
    return <SessionLoading />;
  }

  if (pack === null) {
    return (
      <TodayShell title="Today" chrome={chrome}>
        <div className="mx-auto max-w-sm space-y-3 py-16 text-center">
          <SearchX
            aria-hidden
            className="mx-auto h-8 w-8 text-muted-foreground/70"
          />
          <h2 className="text-base font-semibold tracking-tight">
            Pack not found
          </h2>
          <p className="text-sm text-muted-foreground">
            This pack may have been deleted, or the link points at a pack that
            isn&apos;t yours.
          </p>
          <Button variant="outline" onClick={chrome.onExit}>
            {chrome.backLabel}
          </Button>
        </div>
      </TodayShell>
    );
  }

  // A passage is learned and recited as a whole; its pack has no verse queue.
  const isPassage = passage !== null;
  const data: TodaySessionData = {
    title: pack.name,
    passages: isPassage
      ? duePassages.filter((item) => item.packId === packId)
      : [],
    learning: isPassage ? [] : packLearningSessionVerses(members, now),
    reviews: isPassage
      ? []
      : packReviewSession({
          packId,
          packName: pack.name,
          unifiedReviewEnabled: pack.unifiedReviewEnabled === true,
          members,
          now,
        }).verses,
    hasMemorized:
      hasMemorizedVerses(stats) ||
      members.some((member) => isReviewPhase(member.status)),
  };
  return (
    <TodaySession
      data={data}
      dayKey={learnDismissDayKey(now)}
      chrome={chrome}
    />
  );
}

type TodayStep =
  | { kind: "segment"; index: number }
  | { kind: "between"; next: number }
  | { kind: "summary" };

interface TodayTally {
  passages: string[];
  learned: SessionCompleteVerse[];
  attempts: ReviewSessionAttempt[];
}

function TodaySession({
  data,
  dayKey,
  chrome,
}: {
  data: TodaySessionData;
  dayKey: number;
  chrome: TodayChrome;
}): JSX.Element {
  // Planned once at mount. A passage set aside earlier today ("That's enough
  // for today") stays set aside, like it does in Learn.
  const [segments] = useState(() => {
    const dismissed = readLearnPacksDismissedToday(dayKey);
    return planTodaySession({
      passages: data.passages.filter((item) => !dismissed.has(item.packId)),
      learningVerses: data.learning.length,
      reviews: data.reviews.length,
    });
  });
  const [step, setStep] = useState<TodayStep>(
    segments.length > 0 ? { kind: "segment", index: 0 } : { kind: "summary" },
  );
  const [tally, setTally] = useState<TodayTally>({
    passages: [],
    learned: [],
    attempts: [],
  });

  const finishSegment = (index: number) => {
    setStep(
      index + 1 < segments.length
        ? { kind: "between", next: index + 1 }
        : { kind: "summary" },
    );
  };
  const recordRun = (index: number, result: PracticeSessionResult) => {
    const segment = segments[index];
    setTally((current) => ({
      ...current,
      learned:
        segment?.kind === "learning"
          ? [...current.learned, ...result.verses]
          : current.learned,
      attempts: [...current.attempts, ...result.attempts],
    }));
    finishSegment(index);
  };

  const showExtraPractice =
    data.hasMemorized ||
    tally.attempts.length > 0 ||
    tally.learned.some((verse) => isReviewPhase(verse.status));
  const extraPracticeHref = showExtraPractice
    ? withReturn("/memory/practice", chrome.returnTo ?? "/memory")
    : undefined;

  if (segments.length === 0) {
    return (
      <TodayShell title={data.title} chrome={chrome}>
        <div className="mx-auto max-w-sm space-y-4 py-16 text-center">
          <CheckCircle2
            className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              All caught up
            </h2>
            <p className="text-sm text-muted-foreground">
              Nothing is waiting right now.
            </p>
          </div>
          <div className="flex flex-col-reverse justify-center gap-2 sm:flex-row">
            {extraPracticeHref ? (
              <ExtraPracticeLink href={extraPracticeHref} />
            ) : null}
            <Button onClick={chrome.onExit} className="max-sm:h-11">
              Done
            </Button>
          </div>
        </div>
      </TodayShell>
    );
  }

  if (step.kind === "summary") {
    return (
      <TodayShell
        title={data.title}
        chrome={chrome}
        progress={{ label: "All done", fraction: 1 }}
      >
        <TodaySessionSummary
          passages={tally.passages}
          learned={tally.learned}
          attempts={tally.attempts}
          onDone={chrome.onExit}
          extraPracticeHref={extraPracticeHref}
          returnTo={chrome.returnTo}
        />
      </TodayShell>
    );
  }

  if (step.kind === "between") {
    const next = segments[step.next];
    if (!next) return <SessionLoading />;
    return (
      <TodayShell
        title={data.title}
        chrome={chrome}
        progress={{
          label: todaySegmentHeader(next),
          fraction: todaySessionProgress(segments, step.next),
        }}
      >
        <TodayInterstitial
          next={next}
          onContinue={() => setStep({ kind: "segment", index: step.next })}
          onStop={chrome.onExit}
        />
      </TodayShell>
    );
  }

  const index = step.index;
  const segment = segments[index];
  if (!segment) return <SessionLoading />;
  const progress: SessionProgress = {
    label: todaySegmentHeader(segment),
    fraction: todaySessionProgress(segments, index),
  };

  if (segment.kind === "passage") {
    return (
      <TodayPassageSegment
        key={`passage:${segment.packId}`}
        packId={segment.packId}
        title={segment.title}
        progress={progress}
        chrome={chrome}
        onDone={() => {
          dismissLearnPackForToday(segment.packId, dayKey);
          setTally((current) => ({
            ...current,
            passages: [...current.passages, segment.title],
          }));
          finishSegment(index);
        }}
        onSkip={() => finishSegment(index)}
      />
    );
  }

  return (
    <MemorySessionRunner
      key={segment.kind}
      kind={segment.kind}
      verses={segment.kind === "learning" ? data.learning : data.reviews}
      scopeLabel={data.title}
      onExit={chrome.onExit}
      exitTooltip="Leave today's session"
      backLabel={chrome.backLabel}
      returnTo={chrome.returnTo}
      hasMemorized={data.hasMemorized}
      progress={progress}
      onComplete={(result) => recordRun(index, result)}
      emptyState={<SessionLoading />}
    />
  );
}

function TodayPassageSegment({
  packId,
  title,
  progress,
  chrome,
  onDone,
  onSkip,
}: {
  packId: Id<"packs">;
  title: string;
  progress: SessionProgress;
  chrome: TodayChrome;
  /** "That's enough for today": this passage is done for the day. */
  onDone: () => void;
  /** The passage is gone; move on without counting it. */
  onSkip: () => void;
}): JSX.Element {
  const now = useLiveNow();
  const view = useQuery(api.passageMemory.getForPack, {
    packId,
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
  });

  const skipped = useRef(false);
  useEffect(() => {
    if (view !== null || skipped.current) return;
    skipped.current = true;
    onSkip();
  }, [view, onSkip]);

  if (!view) return <SessionLoading />;

  return (
    <PassageSession
      packId={packId}
      view={view}
      packName={title}
      onExit={chrome.onExit}
      onDoneForToday={onDone}
      exitTooltip="Leave today's session"
      backLabel={chrome.backLabel}
      progress={progress}
    />
  );
}

function TodayInterstitial({
  next,
  onContinue,
  onStop,
}: {
  next: TodaySegment;
  onContinue: () => void;
  onStop: () => void;
}): JSX.Element {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Card className="mx-auto w-full max-w-xl overflow-hidden">
        <CardHeader className="gap-3 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <CardTitle className="text-2xl tracking-tight">
            {todayInterstitialCopy(next)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2 border-t">
          <Button type="button" onClick={onContinue} autoFocus>
            Continue
          </Button>
          <Button type="button" variant="outline" onClick={onStop}>
            Stop for today
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function TodayShell({
  title,
  chrome,
  progress,
  children,
}: {
  title: string;
  chrome: TodayChrome;
  progress?: SessionProgress;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={chrome.onExit}
            className="-ml-2 shrink-0 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {chrome.backLabel}
          </Button>
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg tracking-tight">
            <span className="truncate font-semibold">{title}</span>
            <span
              aria-hidden
              className="hidden text-muted-foreground sm:inline"
            >
              ·
            </span>
            <span className="hidden shrink-0 font-medium text-muted-foreground sm:inline">
              Learn, then review
            </span>
          </h1>
          {progress ? <SessionHeaderProgress progress={progress} /> : null}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 pt-6 pb-24">{children}</div>
      </ScrollArea>
    </div>
  );
}

function SessionLoading(): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
