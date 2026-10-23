import { type JSX, type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  PracticeRunState,
  PracticeSessionResult,
  PracticeVerse,
} from "@/components/memory/practice/practice-board";
import { SessionColumns } from "@/components/memory/practice/session-columns";
import {
  SessionHeaderProgress,
  type SessionProgress,
} from "@/components/memory/practice/session-header-progress";
import {
  TodayQueueOverview,
  TodayQueueRail,
} from "@/components/memory/practice/today-queue-rail";
import {
  hasTodayCarry,
  mergeTodayCarry,
  readTodayCarry,
  writeTodayCarry,
  type TodaySessionCarry,
} from "@/components/memory/practice/today-session-carry";
import { TodaySessionSummary } from "@/components/memory/practice/today-session-summary";
import {
  dueQueueEntryToPracticeVerse,
  toPracticeVerse,
} from "@/components/memory/to-practice-verse";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFrozenQuery } from "@/hooks/use-frozen-query";
import { useLiveNow } from "@/hooks/use-live-now";
import { useMemoryExit } from "@/hooks/use-memory-back";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
  readLearnPacksDismissedToday,
} from "@/lib/learn-dismissed-packs";
import { withReturn } from "@/lib/memory-return";
import { isReviewPhase } from "@/lib/memory-scheduler";
import { hasMemorizedVerses, hasSessionWorkLeft } from "@/lib/memory-session";
import {
  orderRemainingSessionItems,
  sortSessionVerses,
} from "@/lib/memory-session-order";
import type { PracticeOrder } from "@/lib/practice-order";
import {
  carryTodayProgress,
  planTodaySession,
  todayDoneItems,
  todayFinishedSegments,
  todayInterstitialCopy,
  todayNextSegment,
  todayQueueGroups,
  todayQueueItemStep,
  todaySessionCountLabel,
  todaySessionCounts,
  todaySessionProgress,
  type TodayPassageInput,
  type TodayProgressInput,
  type TodayQueueEntry,
  type TodayQueueGroup,
  type TodayQueueItem,
  type TodaySegment,
  type TodaySessionOnly,
} from "@/lib/memory-today-session";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/today";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { verseRefKey } from "../../../shared/verse-ref-key";

interface TodayChrome {
  onExit: () => void;
  backLabel: string;
  exitHref: string;
  returnTo: string | undefined;
  /** Header text after the title: what this session covers. */
  subtitle: string;
}

const SESSION_SUBTITLES: Record<TodaySessionOnly | "all", string> = {
  all: "Learn, then review",
  learning: "New learning",
  review: "Reviews",
};

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
 * `?packId=`, only that pack's work today. With `?only=learning` or
 * `?only=review`, only that half of the day. Done, Stop for today, and Back go
 * to `return`.
 */
export function MemoryTodayPage(): JSX.Element {
  const { packId, only, return: returnTo } = Route.useSearch();
  const exit = useMemoryExit(returnTo);
  const chrome: TodayChrome = {
    onExit: exit.go,
    backLabel: exit.label,
    exitHref: exit.href,
    returnTo,
    subtitle: SESSION_SUBTITLES[only ?? "all"],
  };

  return packId ? (
    <PackTodayLoader
      packId={packId as Id<"packs">}
      only={only}
      chrome={chrome}
    />
  ) : (
    <GlobalTodayLoader only={only} chrome={chrome} />
  );
}

function GlobalTodayLoader({
  only,
  chrome,
}: {
  only: TodaySessionOnly | undefined;
  chrome: TodayChrome;
}): JSX.Element {
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
      only={only}
      dayKey={learnDismissDayKey(now)}
      carryScope={`all:${only ?? "all"}`}
      chrome={chrome}
    />
  );
}

function PackTodayLoader({
  packId,
  only,
  chrome,
}: {
  packId: Id<"packs">;
  only: TodaySessionOnly | undefined;
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
      only={only}
      dayKey={learnDismissDayKey(now)}
      carryScope={`pack:${packId}:${only ?? "all"}`}
      chrome={chrome}
    />
  );
}

type TodayStep =
  | {
      kind: "segment";
      index: number;
      /** Verse card a verse segment opens at. */
      verseId?: string;
    }
  | { kind: "between"; next: number }
  | { kind: "summary" };

interface TodayTally {
  /** Passages worked on today, by segment index, in the order finished. */
  passages: readonly number[];
  /** Each verse segment's results so far, by segment index. */
  runs: Readonly<Record<number, PracticeSessionResult>>;
}

/** Verse cards with nothing left today in the runs opened so far. */
function spentCards(
  segments: readonly TodaySegment[],
  runStates: Readonly<Record<number, PracticeRunState>>,
  now: number,
): Set<string> {
  const spent = new Set<string>();
  segments.forEach((segment, index) => {
    const run = runStates[index];
    if (!run || segment.kind === "passage") return;
    for (const [id, progress] of Object.entries(run.progress)) {
      if (!hasSessionWorkLeft(segment.kind, progress, now)) spent.add(id);
    }
  });
  return spent;
}

/** Earlier visits' work plus this visit's, for the count and the summary. */
function dayCarry(
  segments: readonly TodaySegment[],
  tally: TodayTally,
  earlier: TodaySessionCarry,
  doneItems: number,
): TodaySessionCarry {
  const runResults = segments.flatMap((segment, index) => {
    const result = tally.runs[index];
    return result ? [{ segment, result }] : [];
  });
  return mergeTodayCarry(earlier, {
    doneItems,
    passages: tally.passages.flatMap((index) => {
      const segment = segments[index];
      return segment?.kind === "passage" ? [segment.title] : [];
    }),
    learned: runResults.flatMap(({ segment, result }) =>
      segment.kind === "learning" ? result.verses : [],
    ),
    attempts: runResults.flatMap(({ result }) => result.attempts),
  });
}

/** A verse card's row in today's queue: its reference, or a unified pack's name. */
function queueEntries(
  verses: readonly PracticeVerse[],
  scopeLabel: string,
): TodayQueueEntry[] {
  return verses.map((verse) =>
    verse.composite
      ? {
          id: `unified:${verse.composite.packId}`,
          label: verse.composite.packName ?? scopeLabel,
        }
      : {
          id: verseRefKey(verse.reference),
          label: formatVerseRef(verse.reference),
        },
  );
}

function verseOrderItem(verse: PracticeVerse) {
  return {
    id: verse.composite
      ? `unified:${verse.composite.packId}`
      : verseRefKey(verse.reference),
    reference: verse.reference,
    composite: verse.composite
      ? { members: verse.composite.members }
      : undefined,
  };
}

function itemsInOrder<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);
}

function openQueueItemId(
  step: TodayStep,
  segments: readonly TodaySegment[],
  queue: { learning: TodayQueueEntry[]; reviews: TodayQueueEntry[] },
  shownVerseId?: string,
): string | undefined {
  if (step.kind !== "segment") return undefined;
  const segment = segments[step.index];
  if (!segment) return undefined;
  if (segment.kind === "passage") return segment.packId;
  if (shownVerseId) return shownVerseId;
  if (step.verseId) return step.verseId;
  const entries = segment.kind === "learning" ? queue.learning : queue.reviews;
  return entries[0]?.id;
}

function TodaySession({
  data,
  only,
  dayKey,
  carryScope,
  chrome,
}: {
  data: TodaySessionData;
  only: TodaySessionOnly | undefined;
  dayKey: number;
  /** Which of today's sessions this is, for work carried from earlier visits. */
  carryScope: string;
  chrome: TodayChrome;
}): JSX.Element {
  const now = useLiveNow();
  const navigate = useNavigate();
  const search = Route.useSearch();
  // Planned once at mount. A passage set aside earlier today ("That's enough
  // for today") stays set aside, like it does in Learn.
  const [segments] = useState(() => {
    const dismissed = readLearnPacksDismissedToday(dayKey);
    return planTodaySession({
      passages: data.passages.filter((item) => !dismissed.has(item.packId)),
      learningVerses: data.learning.length,
      reviews: data.reviews.length,
      only,
    });
  });
  // Verse boards run in Scripture order by default; the queue lists them so.
  const [queue] = useState(() => ({
    learning: queueEntries(sortSessionVerses(data.learning), data.title),
    reviews: queueEntries(data.reviews, data.title),
  }));
  const [learningItems] = useState(() =>
    sortSessionVerses(data.learning.map(verseOrderItem)),
  );
  const [reviewItems] = useState(() => data.reviews.map(verseOrderItem));
  const [orderSeed, setOrderSeed] = useState(0);
  const [learningIds, setLearningIds] = useState(() =>
    queue.learning.map((entry) => entry.id),
  );
  const [reviewIds, setReviewIds] = useState(() =>
    queue.reviews.map((entry) => entry.id),
  );
  const learning = itemsInOrder(queue.learning, learningIds);
  const reviews = itemsInOrder(queue.reviews, reviewIds);
  const [step, setStep] = useState<TodayStep>(() => {
    const fromItem =
      search.item === undefined
        ? null
        : todayQueueItemStep(
            segments,
            queue.learning,
            queue.reviews,
            search.item,
          );
    if (fromItem) {
      return {
        kind: "segment",
        index: fromItem.index,
        verseId: fromItem.verseId,
      };
    }
    return segments.length > 0
      ? { kind: "segment", index: 0 }
      : { kind: "summary" };
  });
  const [shownVerseId, setShownVerseId] = useState<string | undefined>();
  // Segments run in plan order, but the queue can jump anywhere, so progress
  // is what's finished plus each verse run's live state.
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const [runStates, setRunStates] = useState<
    Readonly<Record<number, PracticeRunState>>
  >({});
  const [tally, setTally] = useState<TodayTally>({ passages: [], runs: {} });
  const [earlier] = useState(() => readTodayCarry(carryScope, dayKey));

  const hasPassages = segments.some((segment) => segment.kind === "passage");
  const livePassages = useQuery(
    api.passageMemory.dueForLearning,
    hasPassages
      ? { now, tzOffsetMinutes: new Date(now).getTimezoneOffset() }
      : "skip",
  );
  // A finished passage that still has work today can be opened again.
  const reopenable = new Set(livePassages?.map((item) => item.packId));

  const spent = spentCards(segments, runStates, now);
  const progressInput: TodayProgressInput = {
    segments,
    learning,
    reviews,
    done,
    spent,
  };

  const applySessionOrder = (next: PracticeOrder) => {
    const seed = next === "shuffle" ? orderSeed + 1 : orderSeed;
    const pinned = new Set(spent);
    const shown =
      shownVerseId ?? (step.kind === "segment" ? step.verseId : undefined);
    if (shown) pinned.add(shown);
    if (next === "shuffle") setOrderSeed(seed);
    setLearningIds(
      orderRemainingSessionItems(
        itemsInOrder(learningItems, learningIds),
        next,
        seed,
        pinned,
      ).map((item) => item.id),
    );
    setReviewIds(
      orderRemainingSessionItems(
        itemsInOrder(reviewItems, reviewIds),
        next,
        seed,
        pinned,
      ).map((item) => item.id),
    );
  };
  const doneItems = todayDoneItems(progressInput);

  const finishSegment = (index: number) => {
    const nextDone = new Set(done).add(index);
    setDone(nextDone);
    const next = todayNextSegment(
      segments.length,
      todayFinishedSegments({ ...progressInput, done: nextDone }),
      index,
    );
    setStep(next === null ? { kind: "summary" } : { kind: "between", next });
  };
  const saveRun = (
    index: number,
    state: PracticeRunState,
    result: PracticeSessionResult,
  ) => {
    setRunStates((current) => ({ ...current, [index]: state }));
    setTally((current) => ({
      ...current,
      runs: { ...current.runs, [index]: result },
    }));
  };
  const recordRun = (index: number, result: PracticeSessionResult) => {
    setTally((current) => ({
      ...current,
      runs: { ...current.runs, [index]: result },
    }));
    finishSegment(index);
  };
  /** Opens a segment; a verse run picked back up starts at its next card. */
  const openSegment = (index: number, verseId?: string) => {
    const segment = segments[index];
    if (!segment) return;
    // A verse run with every card spent is done, even if its last result was
    // never dismissed: go on to whatever is left instead.
    const finished = todayFinishedSegments(progressInput);
    if (segment.kind !== "passage" && finished.has(index)) {
      const next = todayNextSegment(segments.length, finished, index);
      setStep(next === null ? { kind: "summary" } : { kind: "between", next });
      return;
    }
    const entries =
      segment.kind === "learning"
        ? learning
        : segment.kind === "review"
          ? reviews
          : [];
    const resumeAt =
      runStates[index] === undefined
        ? undefined
        : entries.find((entry) => !spent.has(entry.id))?.id;
    const nextVerseId = verseId ?? resumeAt;
    setStep({ kind: "segment", index, verseId: nextVerseId });
    setShownVerseId(segment.kind === "passage" ? undefined : nextVerseId);
  };
  const openQueueItem = (item: TodayQueueItem) => {
    openSegment(
      item.segment,
      segments[item.segment]?.kind === "passage" ? undefined : item.id,
    );
  };
  const openQueueGroup = (group: TodayQueueGroup) => {
    if (group.target !== null) openSegment(group.target);
  };

  const currentItemId = openQueueItemId(step, segments, queue, shownVerseId);
  useEffect(() => {
    if (search.item === currentItemId) return;
    void navigate({
      to: "/memory/today",
      search: {
        ...(search.packId === undefined ? {} : { packId: search.packId }),
        ...(only === undefined ? {} : { only }),
        ...(search.return === undefined ? {} : { return: search.return }),
        ...(currentItemId === undefined ? {} : { item: currentItemId }),
      },
      replace: true,
    });
  }, [
    currentItemId,
    navigate,
    only,
    search.item,
    search.packId,
    search.return,
  ]);

  const doneCount = todaySessionCounts(segments, doneItems).done;
  const day = dayCarry(segments, tally, earlier, doneCount);
  useEffect(() => {
    writeTodayCarry(
      carryScope,
      dayKey,
      dayCarry(segments, tally, earlier, doneCount),
    );
  }, [carryScope, dayKey, segments, tally, earlier, doneCount]);
  const { learned, attempts, passages: passagesDone } = day;

  const showExtraPractice =
    data.hasMemorized ||
    attempts.length > 0 ||
    learned.some((verse) => isReviewPhase(verse.status));
  const extraPracticeHref = showExtraPractice
    ? withReturn("/memory/practice", chrome.returnTo ?? "/memory")
    : undefined;

  if (segments.length === 0 && !hasTodayCarry(earlier)) {
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

  if (step.kind === "summary" || segments.length === 0) {
    return (
      <TodayShell
        title={data.title}
        chrome={chrome}
        progress={{ label: "All done", fraction: 1 }}
      >
        <TodaySessionSummary
          passages={passagesDone}
          learned={learned}
          attempts={attempts}
          onDone={chrome.onExit}
          extraPracticeHref={extraPracticeHref}
          returnTo={chrome.returnTo}
        />
      </TodayShell>
    );
  }

  /** Header bar for the whole day, so it never reads as one part's progress. */
  const sessionProgress = (items: readonly number[]): SessionProgress => {
    const { counts, fraction } = carryTodayProgress(
      todaySessionCounts(segments, items),
      todaySessionProgress(segments, items),
      earlier.doneItems,
    );
    return { label: todaySessionCountLabel(counts), fraction };
  };
  const queueGroups = (current: number | null) =>
    todayQueueGroups({ ...progressInput, reopenable, current });
  // A queue of one is just the thing on screen.
  const showQueue =
    segments.length > 1 || queue.learning.length + queue.reviews.length > 1;
  const queueRail = (current: number | null) =>
    showQueue ? (
      <TodayQueueRail
        groups={queueGroups(current)}
        counts={
          carryTodayProgress(
            todaySessionCounts(segments, doneItems),
            0,
            earlier.doneItems,
          ).counts
        }
        onSelect={openQueueItem}
      />
    ) : undefined;

  if (step.kind === "between") {
    const next = segments[step.next];
    if (!next) return <SessionLoading />;
    return (
      <TodayShell
        title={data.title}
        chrome={chrome}
        progress={sessionProgress(doneItems)}
      >
        <SessionColumns aside={queueRail(null)}>
          <TodayInterstitial
            next={next}
            onContinue={() => openSegment(step.next)}
            onStop={chrome.onExit}
          />
        </SessionColumns>
      </TodayShell>
    );
  }

  const index = step.index;
  const segment = segments[index];
  if (!segment) return <SessionLoading />;

  if (segment.kind === "passage") {
    return (
      <TodayPassageSegment
        key={`passage:${segment.packId}`}
        packId={segment.packId}
        title={segment.title}
        progress={(todayShare) =>
          sessionProgress(
            doneItems.map((count, item) =>
              item === index ? todayShare : count,
            ),
          )
        }
        aside={queueRail(index)}
        chrome={chrome}
        onDone={() => {
          dismissLearnPackForToday(segment.packId, dayKey);
          setTally((current) =>
            current.passages.includes(index)
              ? current
              : { ...current, passages: [...current.passages, index] },
          );
          finishSegment(index);
        }}
        onSkip={() => finishSegment(index)}
      />
    );
  }

  return (
    <MemorySessionRunner
      key={`${segment.kind}:${step.verseId ?? ""}`}
      kind={segment.kind}
      verses={segment.kind === "learning" ? data.learning : data.reviews}
      scopeLabel={data.title}
      onExit={chrome.onExit}
      backLabel={chrome.backLabel}
      exitHref={chrome.exitHref}
      returnTo={chrome.returnTo}
      hasMemorized={data.hasMemorized}
      progress={(run) =>
        sessionProgress(
          doneItems.map((count, item) => (item === index ? run.done : count)),
        )
      }
      railHeader={
        segments.length > 1 ? (
          <TodayQueueOverview
            groups={queueGroups(index)}
            onSelect={openQueueGroup}
          />
        ) : undefined
      }
      initialVerseId={step.verseId}
      orderedIds={segment.kind === "learning" ? learningIds : reviewIds}
      shownId={shownVerseId ?? step.verseId}
      onShow={setShownVerseId}
      onSessionOrderChange={applySessionOrder}
      onCurrentVerseId={setShownVerseId}
      runState={runStates[index]}
      onRunStateChange={(state, result) => saveRun(index, state, result)}
      onComplete={(result) => recordRun(index, result)}
      emptyState={<SessionLoading />}
    />
  );
}

function TodayPassageSegment({
  packId,
  title,
  progress,
  aside,
  chrome,
  onDone,
  onSkip,
}: {
  packId: Id<"packs">;
  title: string;
  /** The day's bar, given the share of today's new verses added so far. */
  progress: (todayShare: number) => SessionProgress;
  /** The rest of today's queue beside the passage. */
  aside?: ReactNode;
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
      backLabel={chrome.backLabel}
      exitHref={chrome.exitHref}
      progress={progress}
      aside={aside}
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
  const copy = todayInterstitialCopy(next);
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Card className="mx-auto w-full max-w-xl overflow-hidden">
        <CardHeader className="gap-3 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <CardTitle className="text-2xl leading-tight tracking-tight text-balance">
            <h2>{copy.title}</h2>
          </CardTitle>
          <CardDescription className="text-sm">{copy.time}</CardDescription>
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
              {chrome.subtitle}
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
