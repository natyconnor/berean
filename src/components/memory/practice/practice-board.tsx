import {
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { SessionBackButton } from "@/components/memory/session-back-button";
import {
  useEsvCompositePassage,
  type CompositePassageSegment,
} from "@/hooks/use-esv-composite-passage";
import { useEnterToClick } from "@/hooks/use-enter-to-click";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useLiveNow } from "@/hooks/use-live-now";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { devLog } from "@/lib/dev-log";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { diffWords, type DiffToken } from "@/lib/diff-words";
import {
  REFRESH_FINISH_ERROR,
  SESSION_COMPLETE_FOOTER,
  stepShortLabel,
} from "@/lib/memory-copy";
import {
  EnterToCheckHint,
  FirstLettersPanel,
  NeedARefresherInlineOffer,
  NeedARefresherLink,
} from "@/components/memory/memory-refresher-controls";
import { scrollResultBannerIntoView } from "@/components/memory/scroll-result-banner";
import { formatDueDay, nextStepCopy } from "@/lib/memorize-plan";
import { withReturn } from "@/lib/memory-return";
import {
  holdReviewingInterval,
  isLearningLocked,
  isLearningProgressAttempt,
  isReviewPhase,
  LEARN_PROGRESS_ACCURACY,
  MAX_LEARN_STAGE,
  requiredRepsFor,
  REVIEW_LAPSE_ACCURACY,
  reviewGradeOutcome,
  type MemorySchedule,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import {
  memoryScheduleFromSnapshot,
  previewNextSchedule,
  type MemoryScheduleSnapshot,
} from "@/lib/memory-schedule-preview";
import {
  hasSessionWorkLeft,
  type MemorySessionKind,
  type MemorySessionLabel,
} from "@/lib/memory-session";
import {
  orderSessionVerses,
  sessionClusterCount,
} from "@/lib/memory-session-order";
import type { PracticeOrder } from "@/lib/practice-order";
import {
  READER_MEASURE_CLASS,
  READER_REFERENCE_CLASS,
  READER_VERSE_SIZE_CLASS,
  READER_VERSE_TEXT_CLASS,
  SESSION_VERSE_TEXT_CLASS,
} from "@/lib/reader-typography";
import {
  averageReviewAccuracy,
  type ReviewSessionAttempt,
} from "@/lib/review-session-attempts";
import { cn } from "@/lib/utils";
import {
  type HintToken,
  countVerseWords,
  hintForProgress,
  maskVerseText,
} from "@/lib/verse-hint";
import {
  normalizeReps,
  normalizeStageIndex,
  normalizeStatus,
} from "@/lib/verse-practice-progress";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { verseRefKey } from "../../../../shared/verse-ref-key";
import {
  FROM_MEMORY_HINT_PASS_ACTION,
  FROM_MEMORY_HINT_PASS_MESSAGE,
  fromMemoryPromptLine,
  isFromMemoryLearning,
  requiresExactToAdvance,
} from "../../study/from-memory-messages";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
} from "../../study/study-attempt-quality";
import { referenceKey, type CardReference } from "../../study/study-card-model";
import { useVersePracticeAttempt } from "../../study/use-verse-practice-attempt";
import { VerseAttemptResult } from "../../study/verse-attempt-result";
import { REVIEW_RETRY_KEEP_GOING_LABEL } from "../../study/verse-attempt-feedback";
import { useFirstMasteredToast } from "../celebrate/use-milestone-hint";
import { LearningJourneyBar } from "./learning-journey-bar";
import {
  currentStageStep,
  PRACTICE_STAGES,
  practiceChromeFor,
} from "./practice-stages";
import { PracticeVerseRail } from "./practice-verse-rail";
import { ReviewSummary } from "../review-summary";
import { PreviewFillExactAnswerButton } from "../preview-fill-exact-answer-button";
import { SessionComplete, type SessionCompleteVerse } from "./session-complete";
import {
  resolveSessionProgress,
  type SessionProgress,
  type SessionProgressSource,
} from "@/lib/session-progress";
import { SessionHeaderProgress } from "./session-header-progress";

export type { MemorySessionLabel } from "@/lib/memory-session";

/**
 * A pack recited as one passage: every hearted span, in Bible order, graded
 * once. The board loads the concatenated text and sends the grade to
 * `packs.recordUnifiedReview`, which copies it onto every member — no
 * per-verse `verseMemory.recordAttempt`, and no mega verse reference.
 */
export interface PracticeCompositeSet {
  packId: Id<"packs">;
  members: CardReference[];
  /** Pack name, used when this card sits in a mixed global review queue. */
  packName?: string;
  /**
   * Present on passage-mode pack cards. Reviewing/mastered grade through
   * `passageMemory.recordAttempt`. Absent on unified recitation cards — those
   * stay on `packs.recordUnifiedReview` until the user opts in on the pack.
   */
  passageStatus?: "building" | "reviewing" | "mastered";
}

export interface PracticeVerse {
  /**
   * Owned `verseRefs` id when the session already resolved it (due queue,
   * library row, pack member). Recording uses this instead of joining every
   * hearted verse through `savedVerses.listAll`.
   */
  verseRefId?: Id<"verseRefs">;
  reference: CardReference;
  /** Server-authoritative memory rung for this verse (0..3). */
  learnStage: number;
  /**
   * Server-authoritative strong reps banked on the current band. Optional so
   * callers that don't (yet) surface it fall back to a fresh band; read
   * defensively via `stageReps ?? 0`.
   */
  stageReps?: number;
  /**
   * Lifecycle status. Needed so a verse that has already graduated to
   * reviewing/mastered shows a full journey bar instead of the From Memory
   * floor.
   */
  status?: MemoryStatus;
  /**
   * Next availability timestamp. For learning verses, a future `dueAt` means
   * today's session is done (soft lock until tomorrow).
   */
  dueAt?: number;
  /** Last graded attempt; with `dueAt`, distinguishes in-progress from locked. */
  lastReviewedAt?: number;
  /** Live SM-2 fields so review banners can preview "in N days" on Check. */
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
  /**
   * Present on the single card of a unified pack review: the members whose
   * text is concatenated into one recitation.
   */
  composite?: PracticeCompositeSet;
}

/** What a run hands up when it is one part of a longer session. */
export interface PracticeSessionResult {
  /** Every verse the run held, with the step it landed on. */
  verses: SessionCompleteVerse[];
  /** Review grades, in session order. */
  attempts: ReviewSessionAttempt[];
}

/**
 * A run's live state, so a longer session can leave the board and open it
 * again later without the frozen queue undoing what was done in between.
 */
export interface PracticeRunState {
  /** Each card's live schedule, by card id. */
  progress: Readonly<Record<string, VerseProgress>>;
  /** Review grades so far, in session order. */
  attempts: readonly ReviewSessionAttempt[];
  /** Cards graded during the run, by id. */
  graded: readonly string[];
}

interface PracticeBoardProps {
  /** Learning advances today's ladder; Practice is optional graduated recall. */
  kind: MemorySessionKind;
  /** The verse set to practice (e.g. the user's hearted verses or a pack). */
  verses: ReadonlyArray<PracticeVerse>;
  /** Human-readable name for the set being practiced. */
  scopeLabel: string;
  /** Leave the session for where it started. */
  onExit: () => void;
  /** Header back button text, e.g. "Back to Memory". */
  backLabel?: string;
  /** Where Back goes. Home shows when this is not `/memory`. */
  exitHref?: string;
  /** The end-of-session card's primary action. */
  exitLabel?: string;
  /** Where this session returns; Extra practice and per-verse Practice return there too. */
  returnTo?: string;
  /** Something is memorized, so the summary can offer Extra practice. */
  hasMemorized?: boolean;
  /** Verses still due after this run (Review summary only). */
  remainingDue?: number;
  /** Restart the review queue when more verses are still due. */
  onContinueSession?: () => void;
  /**
   * Header text and overall bar when this run is one part of a session. A
   * function gets how many of this run's verses are done.
   */
  progress?: SessionProgressSource;
  /** One part of a longer session: hand the results up instead of a summary. */
  onComplete?: (result: PracticeSessionResult) => void;
  /** Shown above the verse rail, e.g. an overview of the whole session. */
  railHeader?: ReactNode;
  /** Replaces the board's own sidebar. */
  rail?:
    | ReactNode
    | ((api: { changeOrder: (order: PracticeOrder) => void }) => ReactNode);
  /** Card id to open first; the first card in order when absent or unknown. */
  initialVerseId?: string;
  /** The card now on screen, after a rail pick, Next, or Shuffle. */
  onCurrentVerseId?: (id: string) => void;
  /** When set, this run reads card order from the session instead of its own. */
  orderedIds?: readonly string[];
  /** When set, this is the card on screen. */
  shownId?: string;
  /** Ask the session to show another card from the shared list. */
  onShow?: (id: string) => void;
  /** Ask the session to reshuffle or restore Scripture order. */
  onSessionOrderChange?: (order: PracticeOrder) => void;
  /** Pick a run back up where it was left. Read once, at mount. */
  runState?: PracticeRunState;
  /** Every change to the run's state, with the results so far. */
  onRunStateChange?: (
    state: PracticeRunState,
    result: PracticeSessionResult,
  ) => void;
  /** Menu Refresh sitting: First letters → blanks → From memory, then apply the rung. */
  refresh?: boolean;
}

/** Live learning progress the board tracks per verse this session. */
export interface VerseProgress {
  learnStage: number;
  stageReps: number;
  status: MemoryStatus;
  dueAt: number;
  lastReviewedAt?: number;
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
}

interface OrderedVerse {
  id: string;
  verseRefId?: Id<"verseRefs">;
  reference: CardReference;
  learnStage: number;
  stageReps: number;
  status: MemoryStatus;
  dueAt: number;
  lastReviewedAt?: number;
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
  composite?: PracticeCompositeSet;
}

const NO_COMPOSITE_MEMBERS: CardReference[] = [];

function scheduleSnapshotFrom(
  progress: Pick<
    VerseProgress,
    | "status"
    | "learnStage"
    | "stageReps"
    | "dueAt"
    | "ease"
    | "intervalDays"
    | "consecutiveCorrect"
    | "lapses"
    | "earlyReviewApplied"
  >,
): MemoryScheduleSnapshot {
  return {
    status: progress.status,
    learnStage: progress.learnStage,
    stageReps: progress.stageReps,
    dueAt: progress.dueAt,
    ease: progress.ease,
    intervalDays: progress.intervalDays,
    consecutiveCorrect: progress.consecutiveCorrect,
    lapses: progress.lapses,
    earlyReviewApplied: progress.earlyReviewApplied,
  };
}

function scheduleFieldsFrom(verse: {
  ease?: number;
  intervalDays?: number;
  consecutiveCorrect?: number;
  lapses?: number;
  earlyReviewApplied?: boolean;
}): Pick<
  VerseProgress,
  | "ease"
  | "intervalDays"
  | "consecutiveCorrect"
  | "lapses"
  | "earlyReviewApplied"
> {
  return {
    ease: verse.ease,
    intervalDays: verse.intervalDays,
    consecutiveCorrect: verse.consecutiveCorrect,
    lapses: verse.lapses,
    earlyReviewApplied: verse.earlyReviewApplied,
  };
}

/** Where a review spent this session left the card: "Next review Thu". */
function reviewedOutcomeLine(
  progress: Pick<VerseProgress, "status" | "learnStage" | "dueAt">,
  now: number,
): string {
  if (!isReviewPhase(progress.status)) {
    return `Back to ${stepShortLabel(progress.learnStage).toLowerCase()}`;
  }
  return `Next review ${formatDueDay(progress.dueAt, now)}`;
}

function sessionLabelFor(kind: MemorySessionKind): MemorySessionLabel {
  if (kind === "learning") return "Learning";
  if (kind === "review") return "Review";
  return "Practice";
}

function recordModeFor(
  kind: MemorySessionKind,
): "learn" | "practice" | "review" {
  if (kind === "learning") return "learn";
  if (kind === "review") return "review";
  return "practice";
}

/** Skip the library-wide id map only when every verse card can record without it. */
function sessionVersesCanSkipLibraryIds(
  verses: readonly PracticeVerse[],
): boolean {
  return verses.every(
    (verse) => verse.composite !== undefined || verse.verseRefId !== undefined,
  );
}

const SHUFFLE_DURATION_MS = 750;
const DEAL_COUNT = 6;
const DEAL_STAGGER_S = 0.08;
const DEAL_FLY_IN_S = 0.16;
const DEAL_FADE_OUT_S = 0.12;

/**
 * Shared Learning / Practice / Review board: one verse card at a time, a
 * verse rail to jump around, a Shuffle / In-order toggle, and prev/next
 * navigation. "In order" is canonical Bible order. Shuffle permutes chapter
 * (and pack) blocks only — verses learned together stay in Scripture order.
 *
 * Attempts use the session's explicit `learn` or `practice` mode and count
 * fully. The card is driven entirely by the server's
 * `learnStage` + `stageReps`: a Read prime, then the fading support bands
 * (Guided → Challenge → From Memory) that re-randomize and thin their hints per
 * rep. Each recorded attempt adopts the returned `learnStage`/`stageReps`, so
 * the dial advances (exact), holds (close), or steps support back up (off)
 * live in-session.
 */
export function PracticeBoard({
  kind,
  verses,
  scopeLabel,
  onExit,
  backLabel,
  exitHref,
  exitLabel = "Done",
  returnTo,
  hasMemorized = false,
  remainingDue,
  onContinueSession,
  progress,
  onComplete,
  railHeader,
  rail,
  initialVerseId,
  onCurrentVerseId,
  orderedIds,
  shownId,
  onShow,
  onSessionOrderChange,
  runState,
  onRunStateChange,
  refresh = false,
}: PracticeBoardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const now = useLiveNow();
  const [order, setOrder] = useState<PracticeOrder>("in-order");
  // Bumped each time the user (re-)selects Shuffle so repeated presses reshuffle
  // deterministically without depending on Math.random().
  const [seed, setSeed] = useState(0);
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<
    ReviewSessionAttempt[]
  >(() => [...(runState?.attempts ?? [])]);
  // A review graded here and no longer due is spent: it opens read-only so a
  // second same-day recall can't reschedule it again.
  const [gradedIds, setGradedIds] = useState<ReadonlySet<string>>(
    () => new Set(runState?.graded),
  );

  const { recordWithSeqAdopt, resolveVerseRefId } = useVersePracticeAttempt(
    recordModeFor(kind),
    { skipLibraryIds: sessionVersesCanSkipLibraryIds(verses) },
  );
  const recordUnifiedReview = useMutation(api.packs.recordUnifiedReview);
  const recordPassageAttempt = useMutation(api.passageMemory.recordAttempt);
  const finishRefresh = useMutation(api.verseMemory.finishRefresh);
  const [refreshStartedAt] = useState(() => Date.now());
  const acceptVerseRetryHold = useMutation(api.verseMemory.acceptRetryHold);
  const acceptUnifiedRetryHold = useMutation(api.packs.acceptRetryHold);
  const acceptPassageRetryHold = useMutation(api.passageMemory.acceptRetryHold);
  const celebrateMastered = useFirstMasteredToast();
  const sessionLabel = sessionLabelFor(kind);
  const isReview = kind === "review";

  // Snapshot the practice set once when the board mounts. Like ReviewPlayer
  // freezing its due queue, this keeps mid-session heart changes (which mutate
  // the live `verses` prop) from swapping the verse at the current index —
  // especially dangerous under Shuffle, where the order would silently shift.
  const [baseVerses] = useState<OrderedVerse[]>(() =>
    verses.map((verse) => ({
      id: verse.composite
        ? `unified:${verse.composite.packId}`
        : verseRefKey(verse.reference),
      verseRefId: verse.verseRefId,
      reference: verse.reference,
      composite: verse.composite,
      learnStage: normalizeStageIndex(verse.learnStage),
      stageReps: normalizeReps(verse.stageReps ?? 0),
      status: normalizeStatus(verse.status),
      dueAt: verse.dueAt ?? now,
      lastReviewedAt: verse.lastReviewedAt,
      ...scheduleFieldsFrom(verse),
    })),
  );

  // Live per-verse learning progress. Seeded from the frozen snapshot, then
  // advanced by adopting the server-authoritative `learnStage`/`stageReps`/
  // `status`/`dueAt` returned by each recorded attempt, so the fade dial moves
  // in-session (and graduation hands the bar over to progress toward mastered).
  const [progressByVerseId, setProgressByVerseId] = useState<
    Record<string, VerseProgress>
  >(() =>
    Object.fromEntries(
      baseVerses.map((verse) => [
        verse.id,
        runState?.progress[verse.id] ?? {
          learnStage: verse.learnStage,
          stageReps: verse.stageReps,
          status: verse.status,
          dueAt: verse.dueAt,
          lastReviewedAt: verse.lastReviewedAt,
          ...scheduleFieldsFrom(verse),
        },
      ]),
    ),
  );
  // Set once every verse has spent its turn and the learner moves on from the
  // last one, so the run ends on a summary instead of a dead card. A run
  // picked back up with nothing left ends straight away.
  const [finished, setFinished] = useState(
    () =>
      runState !== undefined &&
      baseVerses.every(
        (verse) =>
          !hasSessionWorkLeft(kind, progressByVerseId[verse.id] ?? verse, now),
      ),
  );

  const orderedVerses = useMemo(() => {
    if (orderedIds && orderedIds.length > 0) {
      const byId = new Map(baseVerses.map((verse) => [verse.id, verse]));
      const seen = new Set<string>();
      const next: OrderedVerse[] = [];
      for (const id of orderedIds) {
        const verse = byId.get(id);
        if (verse && !seen.has(id)) {
          next.push(verse);
          seen.add(id);
        }
      }
      for (const verse of baseVerses) {
        if (!seen.has(verse.id)) next.push(verse);
      }
      return next;
    }
    return orderSessionVerses(baseVerses, order, seed);
  }, [baseVerses, order, seed, orderedIds]);
  const [currentId, setCurrentId] = useState(
    () => initialVerseId ?? orderedVerses[0]?.id,
  );

  // The rail (and shuffle overlay) need each verse's *live* progress — the
  // frozen `baseVerses` never moves, so without this the rail dot would stay
  // stuck at whatever band the verse was at when Practice opened.
  const railVerses = useMemo(
    () =>
      orderedVerses.map((verse) => {
        const progress = progressByVerseId[verse.id];
        return {
          ...verse,
          // A composite row stands for the whole pack, so it is labeled with
          // the pack name rather than one member's reference.
          label: verse.composite
            ? (verse.composite.packName ?? scopeLabel)
            : undefined,
          learnStage: progress?.learnStage ?? verse.learnStage,
          stageReps: progress?.stageReps ?? verse.stageReps,
          status: progress?.status ?? verse.status,
          dueAt: progress?.dueAt ?? verse.dueAt,
          lastReviewedAt: progress?.lastReviewedAt ?? verse.lastReviewedAt,
          locked: !hasSessionWorkLeft(
            kind,
            {
              status: progress?.status ?? verse.status,
              dueAt: progress?.dueAt ?? verse.dueAt,
              lastReviewedAt: progress?.lastReviewedAt ?? verse.lastReviewedAt,
            },
            now,
          ),
        };
      }),
    [orderedVerses, progressByVerseId, now, kind, scopeLabel],
  );

  // What the summary lists: each verse where it landed, flagged when it
  // moved from learning into review during this run.
  const sessionVerses = useMemo<SessionCompleteVerse[]>(() => {
    const startedInReview = new Set(
      baseVerses
        .filter((verse) => isReviewPhase(verse.status))
        .map((verse) => verse.id),
    );
    return railVerses.map((verse) => ({
      id: verse.id,
      reference: verse.reference,
      learnStage: verse.learnStage,
      status: verse.status,
      justMemorized:
        isReviewPhase(verse.status) && !startedInReview.has(verse.id),
    }));
  }, [baseVerses, railVerses]);

  const activeId = shownId ?? currentId;
  const foundIndex = orderedVerses.findIndex((verse) => verse.id === activeId);
  const boundedIndex =
    orderedVerses.length === 0 ? 0 : foundIndex >= 0 ? foundIndex : 0;
  const currentVerse = orderedVerses[boundedIndex] ?? null;
  const currentProgress: VerseProgress = currentVerse
    ? (progressByVerseId[currentVerse.id] ?? {
        learnStage: currentVerse.learnStage,
        stageReps: currentVerse.stageReps,
        status: currentVerse.status,
        dueAt: currentVerse.dueAt,
        lastReviewedAt: currentVerse.lastReviewedAt,
        ...scheduleFieldsFrom(currentVerse),
      })
    : {
        learnStage: 0,
        stageReps: 0,
        status: "learning",
        dueAt: now,
      };

  // Soft lock drives the card's "up next tomorrow" chrome; work-left drives
  // navigation, so a verse that graduates mid-session also hands off cleanly.
  const currentLocked = isLearningLocked(currentProgress, now);
  const currentHasWorkLeft = hasSessionWorkLeft(kind, currentProgress, now);
  // A pending retry is still due, so only a review that rescheduled (or
  // lapsed) locks; Practice stays repeatable.
  const currentReviewed =
    isReview &&
    currentVerse !== null &&
    gradedIds.has(currentVerse.id) &&
    !currentHasWorkLeft;
  const freshness = useQuery(
    api.verseMemory.reviewFreshness,
    currentVerse?.verseRefId && !currentVerse.composite
      ? { verseRefId: currentVerse.verseRefId, now }
      : "skip",
  );
  const offerRefresher =
    freshness?.stale === true &&
    (isReview ||
      kind === "practice" ||
      (kind === "learning" &&
        isFromMemoryLearning(
          currentProgress.learnStage,
          currentProgress.status,
        )));

  // The active card's passage: a unified pack is one concatenated recitation,
  // even when it sits next to ordinary verses in the global review queue.
  const composite = currentVerse?.composite ?? null;
  const compositePassage = useEsvCompositePassage(
    composite?.members ?? NO_COMPOSITE_MEMBERS,
    { enabled: composite !== null },
  );

  // Fetch the active verse's text (cache-shared with PracticeCard) so the rail
  // and card can show a length-accurate journey bar via learningJourneyFraction.
  const { data: activeVerseData } = useEsvReference(
    composite ? null : (currentVerse?.reference ?? null),
  );
  const currentWordCount = useMemo(() => {
    if (composite) {
      return compositePassage.text === ""
        ? undefined
        : countVerseWords(compositePassage.text);
    }
    return activeVerseData
      ? countVerseWords(activeVerseData.verses.map((v) => v.text).join(" "))
      : undefined;
  }, [activeVerseData, composite, compositePassage.text]);

  // One recitation grade. Unified packs copy onto every hearted member.
  // Passage-mode reviewing packs grade the frozen passage row. Never
  // auto-starts passage mode from global Review.
  const recordComposite = useCallback(
    async (
      packId: Id<"packs">,
      tokens: ReadonlyArray<DiffToken>,
      wordCount: number,
      passageStatus: PracticeCompositeSet["passageStatus"],
      opts?: { hint?: "first-letters"; holdSchedule?: boolean },
    ): Promise<MemorySchedule | null> => {
      const quality = classifyVerseAttempt(tokens);
      if (!quality) return null;
      const attemptedAt = Date.now();
      const tzOffsetMinutes = new Date(attemptedAt).getTimezoneOffset();
      const timeZone = getViewerTimeZone();
      const accuracy = verseAttemptAccuracy(tokens);
      try {
        if (passageStatus === "reviewing" || passageStatus === "mastered") {
          const view = await recordPassageAttempt({
            packId,
            kind: "review",
            quality,
            accuracy,
            now: attemptedAt,
            tzOffsetMinutes,
            timeZone,
            hint: opts?.hint,
            holdSchedule: opts?.holdSchedule,
          });
          return {
            status: view.status === "mastered" ? "mastered" : "reviewing",
            learnStage: MAX_LEARN_STAGE,
            stageReps: view.stageReps,
            ease: view.ease,
            intervalDays: view.intervalDays,
            dueAt: view.dueAt,
            consecutiveCorrect: view.consecutiveCorrect,
            lapses: view.lapses,
            earlyReviewApplied: view.earlyReviewApplied ?? false,
          };
        }
        return await recordUnifiedReview({
          id: packId,
          quality,
          accuracy,
          now: attemptedAt,
          wordCount,
          tzOffsetMinutes,
          timeZone,
          hint: opts?.hint,
          holdSchedule: opts?.holdSchedule,
        });
      } catch (error) {
        devLog.warn(
          "packs",
          passageStatus
            ? "passageMemory.recordAttempt failed"
            : "recordUnifiedReview failed",
          error,
        );
        return null;
      }
    },
    [recordPassageAttempt, recordUnifiedReview],
  );

  useEffect(() => {
    if (!isShuffling) return;
    const timer = window.setTimeout(
      () => setIsShuffling(false),
      SHUFFLE_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isShuffling, shuffleNonce]);

  const currentVerseId = currentVerse?.id;
  const reportCurrentVerseId = useEffectEvent((id: string) => {
    onCurrentVerseId?.(id);
  });
  useEffect(() => {
    if (currentVerseId) reportCurrentVerseId(currentVerseId);
  }, [currentVerseId]);

  const reportRunState = useEffectEvent(
    (state: PracticeRunState, result: PracticeSessionResult) => {
      onRunStateChange?.(state, result);
    },
  );
  useEffect(() => {
    reportRunState(
      {
        progress: progressByVerseId,
        attempts: sessionAttempts,
        graded: [...gradedIds],
      },
      { verses: sessionVerses, attempts: sessionAttempts },
    );
  }, [progressByVerseId, sessionAttempts, gradedIds, sessionVerses]);

  // Reported after the render that marks the run finished, so the last
  // adopted schedule is in `railVerses`.
  const completionReported = useRef(false);
  useEffect(() => {
    if (!finished || !onComplete || completionReported.current) return;
    completionReported.current = true;
    onComplete({ verses: sessionVerses, attempts: sessionAttempts });
  }, [finished, onComplete, sessionVerses, sessionAttempts]);

  function showVerse(id: string) {
    setIsShuffling(false);
    if (onShow) onShow(id);
    else setCurrentId(id);
  }

  function handleOrderChange(nextOrder: PracticeOrder) {
    setOrder(nextOrder);
    onSessionOrderChange?.(nextOrder);
    if (nextOrder === "shuffle") {
      if (!onSessionOrderChange) setSeed((value) => value + 1);
      setShuffleNonce((value) => value + 1);
      if (!reduceMotion) setIsShuffling(true);
    } else {
      setIsShuffling(false);
    }
  }

  function handleSelectVerse(id: string) {
    if (orderedVerses.some((verse) => verse.id === id)) showVerse(id);
  }

  function adoptVerseSchedule(verseId: string, next: MemorySchedule) {
    const before = progressByVerseId[verseId]?.status;
    if (next.status === "mastered" && before && before !== "mastered") {
      const verse = baseVerses.find((item) => item.id === verseId);
      if (verse) {
        celebrateMastered(
          verse.composite
            ? (verse.composite.packName ?? scopeLabel)
            : formatVerseRefTitle(verse.reference),
        );
      }
    }
    setProgressByVerseId((prev) => ({
      ...prev,
      [verseId]: {
        learnStage: next.learnStage,
        stageReps: next.stageReps,
        status: next.status,
        dueAt: next.dueAt,
        lastReviewedAt: now,
        ease: next.ease,
        intervalDays: next.intervalDays,
        consecutiveCorrect: next.consecutiveCorrect,
        lapses: next.lapses,
        earlyReviewApplied: next.earlyReviewApplied,
      },
    }));
  }

  function advancePastCurrentVerse() {
    const nextAvailable = railVerses.findIndex(
      (verse, index) => index !== boundedIndex && !verse.locked,
    );
    const nextId =
      nextAvailable >= 0 ? railVerses[nextAvailable]?.id : undefined;
    if (nextId) {
      showVerse(nextId);
      return;
    }
    setFinished(true);
  }

  // From a spent card opened read-only: the next card after it with work
  // left, wrapping, or -1 when the run has nothing left.
  let nextOpenIndex = -1;
  for (let step = 1; step < railVerses.length; step += 1) {
    const index = (boundedIndex + step) % railVerses.length;
    if (railVerses[index]?.locked === false) {
      nextOpenIndex = index;
      break;
    }
  }

  function leaveSpentVerse() {
    const nextId =
      nextOpenIndex >= 0 ? railVerses[nextOpenIndex]?.id : undefined;
    if (nextId) {
      showVerse(nextId);
      return;
    }
    setFinished(true);
  }

  async function persistRetryHold(
    attemptedAt: number,
    tzOffsetMinutes: number,
    timeZone?: string,
  ): Promise<MemorySchedule | null> {
    if (!currentVerse) return null;
    if (composite) {
      if (
        composite.passageStatus === "reviewing" ||
        composite.passageStatus === "mastered"
      ) {
        const view = await acceptPassageRetryHold({
          packId: composite.packId,
          now: attemptedAt,
          tzOffsetMinutes,
          timeZone,
        });
        return {
          status: view.status === "mastered" ? "mastered" : "reviewing",
          learnStage: MAX_LEARN_STAGE,
          stageReps: view.stageReps,
          ease: view.ease,
          intervalDays: view.intervalDays,
          dueAt: view.dueAt,
          consecutiveCorrect: view.consecutiveCorrect,
          lapses: view.lapses,
          earlyReviewApplied: view.earlyReviewApplied ?? false,
        };
      }
      return await acceptUnifiedRetryHold({
        id: composite.packId,
        now: attemptedAt,
        tzOffsetMinutes,
        timeZone,
      });
    }
    const verseRefId =
      currentVerse.verseRefId ?? resolveVerseRefId(currentVerse.reference);
    if (!verseRefId) return null;
    return await acceptVerseRetryHold({
      verseRefId,
      now: attemptedAt,
      tzOffsetMinutes,
      timeZone,
    });
  }

  const shellProps = {
    sessionLabel,
    scopeLabel,
    onExit,
    backLabel,
    exitHref,
    progress: resolveSessionProgress(progress, {
      done: railVerses.filter((verse) => verse.locked).length,
      total: railVerses.length,
    }),
  };

  if (orderedVerses.length === 0 || !currentVerse) {
    return (
      <PracticeShell {...shellProps}>
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No verses are available for {sessionLabel.toLowerCase()}.
          </p>
        </div>
      </PracticeShell>
    );
  }

  if (finished) {
    // The enclosing session shows the next part once the results are up.
    if (onComplete)
      return <PracticeShell {...shellProps}>{null}</PracticeShell>;

    const averageAccuracy = averageReviewAccuracy(sessionAttempts);
    const remaining = remainingDue ?? 0;
    const extraPracticeHref =
      kind !== "practice" &&
      (hasMemorized || railVerses.some((verse) => isReviewPhase(verse.status)))
        ? withReturn("/memory/practice", returnTo ?? "/memory")
        : undefined;

    return (
      <PracticeShell {...shellProps}>
        {isReview ? (
          <ReviewSummary
            attempts={sessionAttempts.map((attempt) => ({
              ...attempt,
              status:
                attempt.status ??
                progressByVerseId[verseRefKey(attempt.reference)]?.status,
            }))}
            averageAccuracy={averageAccuracy}
            remaining={remaining}
            onDone={onExit}
            onContinue={
              remaining > 0 && onContinueSession ? onContinueSession : undefined
            }
            doneLabel={exitLabel}
            extraPracticeHref={extraPracticeHref}
            returnTo={returnTo}
          />
        ) : (
          <SessionComplete
            verses={sessionVerses}
            exitLabel={exitLabel}
            onExit={onExit}
            extraPracticeHref={extraPracticeHref}
          />
        )}
      </PracticeShell>
    );
  }

  return (
    <PracticeShell {...shellProps}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="order-2 md:order-1">
          <div className="relative">
            <PracticeCard
              key={currentVerse.id}
              sessionLabel={sessionLabel}
              reference={currentVerse.reference}
              learnStage={currentProgress.learnStage}
              stageReps={currentProgress.stageReps}
              status={currentProgress.status}
              scheduleSnapshot={scheduleSnapshotFrom(currentProgress)}
              locked={currentLocked}
              nextStep={nextStepCopy(currentProgress, now, getViewerTimeZone())}
              reviewedOutcome={
                currentReviewed
                  ? reviewedOutcomeLine(currentProgress, now)
                  : undefined
              }
              onLeaveDone={leaveSpentVerse}
              leaveDoneLabel={nextOpenIndex >= 0 ? "Next" : "Continue"}
              position={boundedIndex}
              total={orderedVerses.length}
              showScheduleOutcome={isReview}
              composite={
                composite
                  ? {
                      title: composite.packName ?? scopeLabel,
                      // The verses the learner actually recites, not the number
                      // of memory units they were learned in.
                      verseCount: composite.members.reduce(
                        (total, member) =>
                          total + member.endVerse - member.startVerse + 1,
                        0,
                      ),
                      text: compositePassage.text,
                      segments: compositePassage.segments,
                      loading: compositePassage.loading,
                      error: compositePassage.error,
                      retry: compositePassage.retry,
                    }
                  : null
              }
              onRecord={(tokens, wordCount, opts) => {
                const verseId = currentVerse.id;
                const accuracy = verseAttemptAccuracy(tokens);
                const hold = opts?.holdSchedule === true || refresh;
                if (!hold) {
                  setGradedIds((prev) =>
                    prev.has(verseId) ? prev : new Set(prev).add(verseId),
                  );
                }
                if (isReview && !hold) {
                  const nextAttempt = {
                    reference: currentVerse.reference,
                    accuracy,
                    // One recitation, one row: the pack name, and no
                    // per-verse practice shortcut to a single member.
                    label: composite
                      ? (composite.packName ?? scopeLabel)
                      : undefined,
                    offerPractice: composite === null,
                  };
                  // Keep every recitation, including an 80%+ retry. The
                  // summary averages them instead of replacing the first try.
                  setSessionAttempts((prev) => [...prev, nextAttempt]);
                }
                if (composite) {
                  return recordComposite(
                    composite.packId,
                    tokens,
                    wordCount,
                    composite.passageStatus,
                    opts,
                  ).then((next) => {
                    if (!next) return null;
                    adoptVerseSchedule(verseId, next);
                    return next;
                  });
                }
                return recordWithSeqAdopt(
                  verseId,
                  {
                    reference: currentVerse.reference,
                    verseRefId: currentVerse.verseRefId,
                    tokens,
                    stage: currentProgress.learnStage,
                    wordCount,
                    hint: opts?.hint,
                    holdSchedule: hold,
                  },
                  (schedule) => {
                    adoptVerseSchedule(verseId, schedule);
                  },
                );
              }}
              offerRefresher={offerRefresher && !refresh}
              refreshSitting={refresh}
              onRefreshFinished={async () => {
                if (!currentVerse.verseRefId) return;
                const attemptedAt = Date.now();
                const next = await finishRefresh({
                  verseRefId: currentVerse.verseRefId,
                  now: attemptedAt,
                  sittingStartedAt: refreshStartedAt,
                  tzOffsetMinutes: new Date(attemptedAt).getTimezoneOffset(),
                  timeZone: getViewerTimeZone(),
                });
                adoptVerseSchedule(currentVerse.id, next);
                setGradedIds((prev) =>
                  prev.has(currentVerse.id)
                    ? prev
                    : new Set(prev).add(currentVerse.id),
                );
              }}
              advancesOnContinue={!currentHasWorkLeft}
              onContinueAfterResult={() => {
                if (refresh) {
                  onExit();
                  return;
                }
                // A spent verse (learning lock, or a review that just
                // rescheduled) should hand off to the next verse that still
                // has a session left rather than parking on a dead end.
                if (currentHasWorkLeft) return;
                advancePastCurrentVerse();
              }}
              onKeepWait={async () => {
                const verseId = currentVerse.id;
                const attemptedAt = Date.now();
                const tzOffsetMinutes = new Date(
                  attemptedAt,
                ).getTimezoneOffset();
                const timeZone = getViewerTimeZone();
                const snapshot = memoryScheduleFromSnapshot(
                  scheduleSnapshotFrom(currentProgress),
                );
                const localHold = snapshot
                  ? holdReviewingInterval(
                      snapshot,
                      attemptedAt,
                      tzOffsetMinutes,
                      timeZone,
                    )
                  : null;
                if (localHold) adoptVerseSchedule(verseId, localHold);
                try {
                  const next = await persistRetryHold(
                    attemptedAt,
                    tzOffsetMinutes,
                    timeZone,
                  );
                  if (next) adoptVerseSchedule(verseId, next);
                } catch (error) {
                  devLog.warn("verseMemory", "acceptRetryHold failed", error);
                }
                advancePastCurrentVerse();
              }}
            />
            <AnimatePresence>
              {isShuffling && (
                <PracticeShuffleOverlay
                  key={`practice-shuffle-${shuffleNonce}`}
                  sessionLabel={sessionLabel}
                  verses={railVerses}
                  firstVerse={
                    railVerses.find((v) => v.id === currentVerse.id) ??
                    currentVerse
                  }
                />
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="order-1 space-y-3 md:order-2">
          {typeof rail === "function"
            ? rail({ changeOrder: handleOrderChange })
            : (rail ?? (
                <>
                  {railHeader}
                  <PracticeVerseRail
                    sessionLabel={sessionLabel}
                    verses={railVerses}
                    activeId={currentVerse.id}
                    onSelectVerse={handleSelectVerse}
                    order={order}
                    onOrderChange={handleOrderChange}
                    shuffleNonce={shuffleNonce}
                    currentLearnStage={currentProgress.learnStage}
                    currentStageReps={currentProgress.stageReps}
                    currentStatus={currentProgress.status}
                    currentIntervalDays={currentProgress.intervalDays}
                    currentEase={currentProgress.ease}
                    currentWordCount={currentWordCount}
                    currentLocked={currentLocked}
                    allowReorder={sessionClusterCount(baseVerses) > 1}
                  />
                </>
              ))}
        </div>
      </div>
    </PracticeShell>
  );
}

/** The pack passage a composite card recites, in place of one verse's text. */
interface CompositeCardPassage {
  /** Pack name, shown instead of a verse reference. */
  title: string;
  verseCount: number;
  text: string;
  segments: CompositePassageSegment[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

interface PracticeCardProps {
  sessionLabel: MemorySessionLabel;
  reference: CardReference;
  /** Server-authoritative band for this verse (0..3). */
  learnStage: number;
  /** Server-authoritative exact reps banked on the current band. */
  stageReps: number;
  /** Lifecycle status — reviewing grows the bar toward mastered. */
  status: MemoryStatus;
  /** Live SM-2 snapshot used to preview the next review interval on Check. */
  scheduleSnapshot: MemoryScheduleSnapshot;
  /** Soft-locked: today's learning session is done. */
  locked: boolean;
  /** What comes next for this verse, shown while it is soft-locked. */
  nextStep: string;
  /**
   * Set once this verse's review is spent for the session: the card is
   * read-only, with this outcome line ("Next review Thu").
   */
  reviewedOutcome?: string;
  /**
   * Moves on from the card while it is read-only (soft-locked or reviewed):
   * to the next card with work left, or to the end of the run.
   */
  onLeaveDone?: () => void;
  /** "Next" while another card has work left, else "Continue". */
  leaveDoneLabel?: string;
  position: number;
  total: number;
  /** Review mode: show schedule-consequence copy above the diff. */
  showScheduleOutcome?: boolean;
  /** Set when this card is a whole pack recited as one passage. */
  composite?: CompositeCardPassage | null;
  onRecord: (
    tokens: ReturnType<typeof diffWords>,
    wordCount: number,
    opts?: { hint?: "first-letters"; holdSchedule?: boolean },
  ) => Promise<MemorySchedule | null>;
  offerRefresher?: boolean;
  refreshSitting?: boolean;
  onRefreshFinished?: () => Promise<void>;
  /**
   * This verse is spent for the session, so dismissing the result leaves the
   * card instead of setting up another rep.
   */
  advancesOnContinue?: boolean;
  /** Fired when the learner dismisses a checked attempt's result. */
  onContinueAfterResult?: () => void;
  /**
   * Review retry offer: move on at the current interval instead of trying
   * again for a stretch. The parent persists the hold and advances.
   */
  onKeepWait?: () => Promise<void>;
}

function PracticeCard({
  sessionLabel,
  reference,
  learnStage,
  stageReps,
  status,
  scheduleSnapshot,
  locked,
  nextStep,
  reviewedOutcome,
  onLeaveDone,
  leaveDoneLabel = "Continue",
  position,
  total,
  showScheduleOutcome = false,
  composite = null,
  onRecord,
  advancesOnContinue = false,
  onContinueAfterResult,
  onKeepWait,
  offerRefresher = false,
  refreshSitting = false,
  onRefreshFinished,
}: PracticeCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  // Whether the current answer has been checked (and thus recorded). Persists
  // through the resulting band/rep change so the feedback stays visible until
  // the learner continues.
  const [checked, setChecked] = useState(false);
  // Snapshot of "First letters · N of M today" at Check so the step label stays
  // on the step just finished while the journey bar adopts banked progress early.
  const [heldGoalLabel, setHeldGoalLabel] = useState<string | null>(null);
  const [nextSchedule, setNextSchedule] = useState<MemorySchedule | null>(null);
  const [outcomeNow, setOutcomeNow] = useState(() => Date.now());
  const [rescue, setRescue] = useState<"off" | "letters" | "memory">("off");
  const [rescueHold, setRescueHold] = useState(false);
  const [refreshStep, setRefreshStep] = useState<1 | 2 | 3>(1);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const reviewActionRef = useRef<HTMLButtonElement>(null);
  const resultBannerRef = useRef<HTMLDivElement>(null);
  // Serializes attempt submission for this card: the synchronous in-flight lock
  // collapses same-tick double activations (double-tap, touch+mouse, Enter +
  // click) into a single recorded attempt, and `submitPending` shows a spinner
  // on the disabled control while it's in flight. One lock covers Read, check,
  // and keep-going so those actions can't overlap.
  const { submit, pending: submitPending } = useSubmitLock();
  // Which submit owns the spinner. The result button mounts as soon as the
  // answer is checked, while the save is still running — "Saving..." holds
  // that label until the record settles so it doesn't offer Try again or
  // Continue early. Set in the same turn as the lock, so it batches with
  // `submitPending` and both clear on the render that ends the save.
  const [submitKind, setSubmitKind] = useState<
    "grade" | "read" | "keep" | null
  >(null);
  const gradePending = submitPending && submitKind === "grade";

  const refLabel = formatVerseRefTitle(reference);
  // A composite card recites many spans, so it takes its text from the pack's
  // concatenated passage instead of a single chapter slice.
  const single = useEsvReference(composite ? null : reference);
  const data = composite ? null : single.data;
  const loading = composite ? composite.loading : single.loading;
  const error = composite ? composite.error : single.error;
  const retryLoad = composite ? composite.retry : single.retry;
  const versePlainText = composite
    ? composite.text
    : data
      ? data.verses.map((v) => v.text).join(" ")
      : "";

  const displayStage = refreshSitting
    ? refreshStep
    : rescue === "letters"
      ? 1
      : rescue === "memory"
        ? 3
        : learnStage;
  const hintReps = refreshSitting || rescue !== "off" ? 0 : stageReps;
  const stageInfo = PRACTICE_STAGES[displayStage] ?? PRACTICE_STAGES[0];
  const stageColor = practiceChromeFor(displayStage, status);
  const { hintStage, tokens, wordCount } = useMemo(() => {
    const wc = countVerseWords(versePlainText);
    const hint = hintForProgress(displayStage, hintReps, wc);
    return {
      hintStage: hint.stage,
      tokens: maskVerseText(versePlainText, hint.stage, {
        density: hint.density,
        seed: hint.seed,
      }),
      wordCount: wc,
    };
  }, [versePlainText, displayStage, hintReps]);

  const requiredToday = requiredRepsFor(learnStage, wordCount);
  const liveGoalLabel =
    status === "reviewing" || status === "mastered"
      ? null
      : `${stageInfo.label} · ${currentStageStep(stageReps, requiredToday)} of ${requiredToday} today`;
  const sessionGoalLabel = heldGoalLabel ?? liveGoalLabel;

  // A session-ending clear locks the verse the instant its attempt is adopted.
  // Hold the graded result until the learner continues so the feedback they
  // just earned isn't swapped out from under them.
  const reviewed = reviewedOutcome !== undefined;
  const refresherOpen = rescue !== "off" || refreshSitting;
  const showReviewed = reviewed && !checked && !refresherOpen;
  const showLocked = locked && !checked && !showReviewed;
  const showDone = showLocked || showReviewed;

  const isReadPrime = hintStage === "full";
  const fromMemoryLearn = isFromMemoryLearning(learnStage, status);
  const promptLine = showReviewed
    ? "Done for today"
    : showLocked
      ? nextStep
      : isReadPrime
        ? "Read it through, then continue"
        : fromMemoryLearn
          ? fromMemoryPromptLine(stageReps)
          : hintStage === "hidden"
            ? composite
              ? "Recite the whole passage from memory"
              : "Recall the verse from memory"
            : "Type what you remember";

  const canCheckAnswer =
    !locked &&
    (!reviewed || refresherOpen) &&
    !loading &&
    !error &&
    typedAnswer.trim().length > 0 &&
    versePlainText !== "";
  const canContinueRead =
    !locked &&
    (!reviewed || refresherOpen) &&
    !loading &&
    !error &&
    versePlainText !== "";
  const checkedDiffTokens = useMemo(
    () => (checked ? diffWords(typedAnswer, versePlainText) : []),
    [checked, typedAnswer, versePlainText],
  );
  const checkedAccuracy = verseAttemptAccuracy(checkedDiffTokens);
  const checkedQuality = classifyVerseAttempt(checkedDiffTokens);
  const offerUnhintedFromMemoryRetry =
    fromMemoryLearn &&
    rescue === "letters" &&
    !rescueHold &&
    !refreshSitting &&
    checked &&
    (checkedAccuracy >= LEARN_PROGRESS_ACCURACY || checkedQuality === "exact");
  const madeLearningProgress =
    checkedQuality !== null &&
    isLearningProgressAttempt(
      checkedQuality,
      checkedAccuracy,
      learnStage,
      stageReps,
      wordCount,
    );
  // Once graduated, another strong recall is just another practice pass — offer
  // "Try again" instead of implying the learning journey still advances. Review
  // spends the verse after a hold, stretch, or lapse (`advancesOnContinue`);
  // an 80%+ retry stays due so this path still shows Try again, plus Keep
  // going so they can decline the extra attempt.
  const offerPracticeAgain =
    !advancesOnContinue &&
    (status === "reviewing" || status === "mastered" || !madeLearningProgress);
  const reviewRetryOffer =
    showScheduleOutcome &&
    checked &&
    checkedQuality !== null &&
    reviewGradeOutcome(checkedQuality, checkedAccuracy) === "retry";

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
    // Practice counts fully: every checked attempt records and reschedules. The
    // lock keeps a double-tap from recording twice before the result view
    // (driven by `checked`) mounts and replaces this button. The action stays
    // disabled, labeled Saving..., until the record settles. Grading is local
    // and already on screen; the wait is the Convex write.
    setSubmitKind("grade");
    submit(async () => {
      const now = Date.now();
      const tokens = diffWords(typedAnswer, versePlainText);
      const quality = classifyVerseAttempt(tokens);
      const accuracy = verseAttemptAccuracy(tokens);
      // Preview the next interval locally so the result banner never flashes
      // "soon" while `recordAttempt` is in flight. Server schedule still wins
      // when it lands.
      const usingHint =
        rescue === "letters" || (refreshSitting && refreshStep === 1);
      const holding = rescueHold || refreshSitting;
      const preview =
        showScheduleOutcome && quality
          ? previewNextSchedule(scheduleSnapshot, {
              quality,
              accuracy,
              mode: "review",
              now,
              wordCount: wordCount ?? 0,
              tzOffsetMinutes: new Date(now).getTimezoneOffset(),
              timeZone: getViewerTimeZone(),
              hint: usingHint ? "first-letters" : undefined,
              holdSchedule: holding,
            })
          : null;
      // Freeze the step label on the step being graded; journey props may adopt
      // as soon as `onRecord` settles, but the label waits for Continue.
      if (status !== "reviewing" && status !== "mastered") {
        setHeldGoalLabel(
          `${stageInfo.label} · ${currentStageStep(stageReps, requiredToday)} of ${requiredToday} today`,
        );
      }
      setChecked(true);
      setOutcomeNow(now);
      setNextSchedule(preview);
      const schedule = await onRecord(tokens, wordCount ?? 0, {
        hint: usingHint ? "first-letters" : undefined,
        holdSchedule: holding,
      });
      if (schedule) setNextSchedule(schedule);
    });
  }

  function continueRead() {
    if (!canContinueRead) return;
    // Submitting the shown (full) text banks the single Read rep, advancing the
    // scheduler to the first fading band. The lock collapses same-tick double
    // activations; it releases whatever the outcome, so a null/unchanged result
    // (mutation error, verse not hearted) re-enables Continue rather than
    // stranding it. On the normal success path the band advances and this
    // button is unmounted.
    setSubmitKind("read");
    submit(async () => {
      setOutcomeNow(Date.now());
      setNextSchedule(null);
      const schedule = await onRecord(
        diffWords(versePlainText, versePlainText),
        wordCount ?? 0,
      );
      if (schedule) setNextSchedule(schedule);
    });
  }

  function resetCard() {
    setChecked(false);
    setHeldGoalLabel(null);
    setTypedAnswer("");
    setNextSchedule(null);
  }

  function continueAttempt() {
    const madeRefreshProgress =
      checkedAccuracy >= LEARN_PROGRESS_ACCURACY || checkedQuality === "exact";
    if (refreshSitting && madeRefreshProgress && refreshStep < 3) {
      setRefreshStep((step) => (step === 1 ? 2 : 3));
      resetCard();
      window.requestAnimationFrame(() => answerInputRef.current?.focus());
      return;
    }
    if (refreshSitting && madeRefreshProgress && refreshStep === 3) {
      setSubmitKind("keep");
      submit(async () => {
        try {
          await onRefreshFinished?.();
          setRefreshError(null);
          resetCard();
          onContinueAfterResult?.();
        } catch {
          setRefreshError(REFRESH_FINISH_ERROR);
        }
      });
      return;
    }
    if (rescue === "letters" && (rescueHold || offerUnhintedFromMemoryRetry)) {
      setRescue("memory");
      resetCard();
      window.requestAnimationFrame(() => answerInputRef.current?.focus());
      return;
    }
    resetCard();
    if (rescue !== "off") {
      setRescue("off");
      setRescueHold(false);
    }
    onContinueAfterResult?.();
    window.requestAnimationFrame(() => answerInputRef.current?.focus());
  }

  function openRefresher(hold: boolean) {
    setRescue("letters");
    setRescueHold(hold);
    resetCard();
    window.requestAnimationFrame(() => answerInputRef.current?.focus());
  }

  function keepThisWait() {
    if (!onKeepWait) return;
    setSubmitKind("keep");
    submit(async () => {
      await onKeepWait();
    });
  }

  // Read Continue and the result-view Continue / Try again share one control
  // (only one is mounted at a time) so Enter can advance both steps.
  useEnterToClick(
    reviewActionRef,
    showDone ? onLeaveDone !== undefined : checked || isReadPrime,
  );

  useEffect(() => {
    if (showDone || (!checked && !isReadPrime)) return;
    reviewActionRef.current?.focus({ preventScroll: true });
    if (checked) {
      scrollResultBannerIntoView(resultBannerRef.current);
    }
  }, [checked, isReadPrime, showDone]);

  // After Read advances into a typing band (or when landing mid-ladder), put
  // the caret in the answer box. Continue is unmounted, so without this the
  // document is left unfocused until the learner clicks.
  useEffect(() => {
    if (showDone || checked || isReadPrime) return;
    answerInputRef.current?.focus();
  }, [checked, isReadPrime, showDone]);

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

  const settledResultAction = offerPracticeAgain ? (
    <>
      <RotateCcw className="h-4 w-4" aria-hidden />
      Try again
    </>
  ) : (
    <>
      <ArrowRight className="h-4 w-4" aria-hidden />
      Continue
    </>
  );
  const refreshStepDone =
    refreshSitting &&
    (checkedAccuracy >= LEARN_PROGRESS_ACCURACY || checkedQuality === "exact");
  const resultActionLabel = gradePending ? (
    "Saving..."
  ) : offerUnhintedFromMemoryRetry ? (
    <>
      <RotateCcw className="h-4 w-4" aria-hidden />
      {FROM_MEMORY_HINT_PASS_ACTION}
    </>
  ) : refreshStepDone ? (
    <>
      <ArrowRight className="h-4 w-4" aria-hidden />
      Continue
    </>
  ) : (
    settledResultAction
  );
  const afterMissOffer =
    checked &&
    checkedAccuracy < REVIEW_LAPSE_ACCURACY &&
    rescue === "off" &&
    !refreshSitting &&
    (showScheduleOutcome ||
      fromMemoryLearn ||
      status === "reviewing" ||
      status === "mastered");
  const showAfterMiss = afterMissOffer && !gradePending;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <Card className={cn("mx-auto w-full overflow-hidden", stageColor.panel)}>
        <CardHeader className="gap-3 text-center">
          <div>
            <p
              className={cn(
                "inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]",
                stageColor.text,
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full", stageColor.dot)}
                aria-hidden
              />
              {sessionLabel} · {stageInfo.label}
            </p>
            <CardTitle className={cn("mt-2", READER_REFERENCE_CLASS)}>
              {composite ? composite.title : refLabel}
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {composite
              ? `${composite.verseCount} verse${composite.verseCount === 1 ? "" : "s"} · one recitation`
              : `Verse ${position + 1} of ${total}`}
          </p>
          <p className={cn("text-xs font-medium", stageColor.text)}>
            {promptLine}
          </p>
          {sessionGoalLabel && !locked && !showReviewed ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {sessionGoalLabel}
            </p>
          ) : null}
          <LearningJourneyBar
            learnStage={learnStage}
            stageReps={stageReps}
            wordCount={wordCount}
            status={status}
            intervalDays={scheduleSnapshot.intervalDays}
            ease={scheduleSnapshot.ease}
          />
          {locked ? (
            <p className="text-xs text-muted-foreground">
              Tomorrow: {stageInfo.label}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5">
          {showReviewed ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border bg-background/75 px-5 py-8 text-center">
              <CheckCircle2
                className={cn("h-8 w-8", stageColor.text)}
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">Reviewed</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {reviewedOutcome}
              </p>
            </div>
          ) : showLocked ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border bg-background/75 px-5 py-8 text-center">
              <CheckCircle2
                className={cn("h-8 w-8", stageColor.text)}
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">
                Done for today
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                You&apos;ve done today&apos;s step for this verse.{" "}
                {SESSION_COMPLETE_FOOTER}
              </p>
            </div>
          ) : (
            <>
              {!checked && (
                <>
                  <div
                    className={cn(
                      "mx-auto min-h-[220px] rounded-xl border bg-background/75 px-5 py-5 text-left",
                      SESSION_VERSE_TEXT_CLASS,
                      READER_MEASURE_CLASS,
                      // A whole passage scrolls inside the card instead of
                      // pushing the answer box off the screen.
                      composite && "max-h-[45vh] overflow-y-auto",
                      stageColor.panel,
                    )}
                  >
                    {loading ? (
                      <div className="space-y-3 py-2">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
                      </div>
                    ) : error ? (
                      <div className="space-y-3 font-sans">
                        <p className="text-sm text-destructive">
                          Could not load verse text.
                        </p>
                        <Button size="sm" variant="outline" onClick={retryLoad}>
                          Retry
                        </Button>
                      </div>
                    ) : hintStage === "hidden" &&
                      rescue !== "letters" &&
                      !(refreshSitting && refreshStep === 1) ? (
                      <div className="flex h-full min-h-[140px] items-center justify-center text-center font-sans">
                        <p className="max-w-sm text-sm text-muted-foreground">
                          {composite
                            ? "No hint text. Type the passage from memory — verse numbers not needed — then check your answer."
                            : "No hint text. Type the verse from memory, then check your answer."}
                        </p>
                      </div>
                    ) : rescue === "letters" ||
                      (refreshSitting && refreshStep === 1) ? (
                      <FirstLettersPanel text={versePlainText} />
                    ) : (
                      <HintTokenText tokens={tokens} />
                    )}
                  </div>

                  {!isReadPrime && (
                    <Textarea
                      ref={answerInputRef}
                      value={typedAnswer}
                      onChange={(event) => setTypedAnswer(event.target.value)}
                      onKeyDown={handleAnswerKeyDown}
                      placeholder={
                        composite
                          ? "Type the passage from memory"
                          : "Type what you remember"
                      }
                      className={cn(
                        "mx-auto bg-background/80 px-4 py-3",
                        SESSION_VERSE_TEXT_CLASS,
                        READER_MEASURE_CLASS,
                        composite
                          ? "min-h-[300px] max-h-[60vh] resize-y"
                          : "min-h-[170px] resize-none",
                      )}
                      aria-label={
                        composite
                          ? "Your recited passage"
                          : "Your recalled verse"
                      }
                    />
                  )}
                </>
              )}

              {checked && (
                <div className="space-y-4">
                  <VerseAttemptResult
                    typedAnswer={typedAnswer}
                    versePlainText={versePlainText}
                    diffTokens={checkedDiffTokens}
                    showScheduleOutcome={showScheduleOutcome}
                    requireExactToAdvance={requiresExactToAdvance(
                      learnStage,
                      status,
                      stageReps,
                      wordCount,
                    )}
                    nextSchedule={nextSchedule}
                    now={outcomeNow}
                    praiseLine={
                      offerUnhintedFromMemoryRetry
                        ? FROM_MEMORY_HINT_PASS_MESSAGE
                        : undefined
                    }
                    bannerRef={resultBannerRef}
                    refresherOffer={
                      afterMissOffer ? (
                        <NeedARefresherInlineOffer
                          onClick={() => openRefresher(true)}
                          disabled={submitPending}
                          visible={showAfterMiss}
                        />
                      ) : undefined
                    }
                  />
                  {checkedQuality !== "exact" && (
                    <div
                      className={cn(
                        "mx-auto rounded-xl border bg-card/60 px-4 py-3 text-left",
                        READER_VERSE_SIZE_CLASS,
                        READER_MEASURE_CLASS,
                        composite && "max-h-[45vh] overflow-y-auto",
                      )}
                    >
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Full text
                      </p>
                      {composite
                        ? composite.segments.map((segment) => (
                            <p
                              key={referenceKey(segment.reference)}
                              className={READER_VERSE_TEXT_CLASS}
                            >
                              <span className="mr-1 align-top font-sans text-xs font-semibold text-muted-foreground">
                                {formatVerseRefTitle(segment.reference)}
                              </span>
                              {segment.text}
                            </p>
                          ))
                        : data?.verses.map((verse) => (
                            <p
                              key={verse.number}
                              className={READER_VERSE_TEXT_CLASS}
                            >
                              <span className="mr-1 align-top font-sans text-xs font-semibold text-muted-foreground">
                                {verse.number}
                              </span>
                              {verse.text}
                            </p>
                          ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-end border-t">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!showDone && !checked && !isReadPrime ? (
              <EnterToCheckHint className="sm:mr-auto" />
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              {refreshError ? (
                <p className="w-full text-xs text-destructive sm:mr-auto sm:w-auto">
                  {refreshError}
                </p>
              ) : null}
              {!showDone && !checked && !isReadPrime ? (
                <PreviewFillExactAnswerButton
                  versePlainText={versePlainText}
                  onFill={setTypedAnswer}
                  disabled={loading || Boolean(error)}
                />
              ) : null}
              {showDone ? (
                onLeaveDone ? (
                  <Button
                    ref={reviewActionRef}
                    type="button"
                    variant="default"
                    className="flex-1 sm:flex-none"
                    onClick={onLeaveDone}
                  >
                    {leaveDoneLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null
              ) : checked ? (
                reviewRetryOffer && onKeepWait && rescue === "off" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={keepThisWait}
                      loading={submitPending}
                    >
                      {REVIEW_RETRY_KEEP_GOING_LABEL}
                    </Button>
                    <Button
                      ref={reviewActionRef}
                      type="button"
                      variant="default"
                      className="flex-1 sm:flex-none"
                      onClick={continueAttempt}
                      loading={submitPending}
                    >
                      {resultActionLabel}
                    </Button>
                  </>
                ) : (
                  <Button
                    ref={reviewActionRef}
                    type="button"
                    variant="default"
                    className="flex-1 sm:flex-none"
                    onClick={continueAttempt}
                    loading={submitPending}
                  >
                    {resultActionLabel}
                  </Button>
                )
              ) : isReadPrime ? (
                <Button
                  ref={reviewActionRef}
                  type="button"
                  variant="default"
                  className="flex-1 sm:flex-none"
                  onClick={continueRead}
                  disabled={!canContinueRead}
                  loading={submitPending}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : (
                <>
                  {offerRefresher && rescue === "off" && !refreshSitting ? (
                    <NeedARefresherLink
                      onClick={() => openRefresher(false)}
                      disabled={submitPending}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="default"
                    className="h-11 flex-1 sm:flex-none"
                    onClick={checkAnswer}
                    disabled={!canCheckAnswer}
                    loading={submitPending}
                  >
                    {gradePending ? (
                      "Saving..."
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Check answer
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function PracticeShuffleOverlay({
  sessionLabel,
  verses,
  firstVerse,
}: {
  sessionLabel: MemorySessionLabel;
  verses: ReadonlyArray<OrderedVerse>;
  firstVerse: OrderedVerse;
}): JSX.Element {
  const samples = useMemo<OrderedVerse[]>(() => {
    const others = verses.filter((verse) => verse.id !== firstVerse.id);
    const leadIns: OrderedVerse[] = [];
    for (let i = 0; i < DEAL_COUNT - 1; i += 1) {
      const pick =
        others.length > 0 ? others[(i * 3 + 1) % others.length] : firstVerse;
      leadIns.push(pick ?? firstVerse);
    }
    return [...leadIns, firstVerse];
  }, [verses, firstVerse]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 50 }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeOut" } }}
    >
      {samples.map((sample, index) => (
        <PracticeShuffleCard
          key={`${index}-${sample.id}`}
          sessionLabel={sessionLabel}
          index={index}
          verse={sample}
          isLast={index === samples.length - 1}
        />
      ))}
    </motion.div>
  );
}

function PracticeShuffleCard({
  sessionLabel,
  index,
  verse,
  isLast,
}: {
  sessionLabel: MemorySessionLabel;
  index: number;
  verse: OrderedVerse;
  isLast: boolean;
}): JSX.Element {
  const fromLeft = index % 2 === 0;
  const startX = fromLeft ? -360 : 360;
  const startRotate = fromLeft ? -10 : 10;
  const delay = index * DEAL_STAGGER_S;
  const totalDuration = isLast
    ? DEAL_FLY_IN_S
    : DEAL_FLY_IN_S + DEAL_FADE_OUT_S;
  const flyInFrac = DEAL_FLY_IN_S / totalDuration;

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-xl border bg-card shadow-md"
      style={{ zIndex: 50 + index }}
      initial={{ x: startX, y: 0, rotate: startRotate, opacity: 0 }}
      animate={
        isLast
          ? { x: 0, y: 0, rotate: 0, opacity: 1 }
          : {
              x: [startX, 0, 0],
              y: [0, 0, 6],
              rotate: [startRotate, 0, 0],
              opacity: [0, 1, 0],
            }
      }
      transition={{
        delay,
        duration: totalDuration,
        times: isLast ? undefined : [0, flyInFrac, 1],
        ease: "easeOut",
      }}
    >
      <PracticeShuffleCardFace sessionLabel={sessionLabel} verse={verse} />
    </motion.div>
  );
}

function PracticeShuffleCardFace({
  sessionLabel,
  verse,
}: {
  sessionLabel: MemorySessionLabel;
  verse: OrderedVerse;
}): JSX.Element {
  const refLabel = formatVerseRefTitle(verse.reference);
  const stage = PRACTICE_STAGES[verse.learnStage] ?? PRACTICE_STAGES[0];
  const stageColor = practiceChromeFor(verse.learnStage, verse.status);

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center gap-5 px-6 py-8 text-center",
        stageColor.panel,
      )}
    >
      <div>
        <p
          className={cn(
            "inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]",
            stageColor.text,
          )}
        >
          <span
            className={cn("h-2 w-2 rounded-full", stageColor.dot)}
            aria-hidden
          />
          {sessionLabel} · {stage.label}
        </p>
        <h2 className={cn("mt-2 text-foreground", READER_REFERENCE_CLASS)}>
          {refLabel}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Shuffling your {sessionLabel.toLowerCase()} order
      </p>
      <div className="min-h-[200px] w-full max-w-xl rounded-md border border-input bg-background/80 px-3 py-2 text-left text-sm text-muted-foreground/50">
        Type what you remember
      </div>
    </div>
  );
}

function HintTokenText({ tokens }: { tokens: ReadonlyArray<HintToken> }) {
  return (
    <p className="whitespace-pre-wrap">
      {tokens.map((token, index) => (
        <span
          key={index}
          className={cn(
            token.masked && "font-mono tracking-wide text-muted-foreground",
          )}
        >
          {token.text}
        </span>
      ))}
    </p>
  );
}

function PracticeShell({
  sessionLabel,
  scopeLabel,
  onExit,
  backLabel = "Back to Memory",
  exitHref,
  progress,
  children,
}: {
  sessionLabel: MemorySessionLabel;
  scopeLabel: string;
  onExit: () => void;
  backLabel?: string;
  exitHref?: string;
  progress?: SessionProgress;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <SessionBackButton
            onExit={onExit}
            label={backLabel}
            exitHref={exitHref}
          />
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg tracking-tight">
            <span className="shrink-0 font-semibold">{sessionLabel}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="truncate font-medium text-muted-foreground">
              {scopeLabel}
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
