import {
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useLiveNow } from "@/hooks/use-live-now";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { diffWords } from "@/lib/diff-words";
import {
  isLearningLocked,
  isLearningProgressAttempt,
  requiredRepsFor,
  type MemorySchedule,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import {
  previewNextSchedule,
  type MemoryScheduleSnapshot,
} from "@/lib/memory-schedule-preview";
import {
  hasSessionWorkLeft,
  type MemorySessionKind,
  type MemorySessionLabel,
} from "@/lib/memory-session";
import { buildPracticeOrder, type PracticeOrder } from "@/lib/practice-order";
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
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { verseRefKey } from "../../../../shared/verse-ref-key";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
} from "../../study/study-attempt-quality";
import { referenceKey, type CardReference } from "../../study/study-card-model";
import { useVersePracticeAttempt } from "../../study/use-verse-practice-attempt";
import { VerseAttemptResult } from "../../study/study-verse-memory-card";
import { LearningJourneyBar } from "./learning-journey-bar";
import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";
import { PracticeVerseRail } from "./practice-verse-rail";
import { ReviewSummary, type ReviewSessionAttempt } from "../review-summary";
import { PreviewFillExactAnswerButton } from "../preview-fill-exact-answer-button";
import { SessionComplete } from "./session-complete";

export type { MemorySessionLabel } from "@/lib/memory-session";

export interface PracticeVerse {
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
}

interface PracticeBoardProps {
  /** Learning advances today's ladder; Practice is optional graduated recall. */
  kind: MemorySessionKind;
  /** The verse set to practice (e.g. the user's hearted verses or a pack). */
  verses: ReadonlyArray<PracticeVerse>;
  /** Human-readable name for the set being practiced. */
  scopeLabel: string;
  /** Return to the memory home or pack. */
  onExit: () => void;
  /** Describes the back-button destination. */
  exitTooltip?: string;
  /** Names the back-button destination on the end-of-session card. */
  exitLabel?: string;
  /** Verses still due after this run (Review summary only). */
  remainingDue?: number;
  /** Restart the review queue when more verses are still due. */
  onContinueSession?: () => void;
}

/** Live learning progress the board tracks per verse this session. */
interface VerseProgress {
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
}

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

const SHUFFLE_DURATION_MS = 750;
const DEAL_COUNT = 6;
const DEAL_STAGGER_S = 0.08;
const DEAL_FLY_IN_S = 0.16;
const DEAL_FADE_OUT_S = 0.12;

/**
 * Shared Learning / Practice board: one verse card at a time, a verse rail to
 * jump around, a Shuffle / In-order toggle, and prev/next navigation.
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
  exitTooltip,
  exitLabel = "Back to Memory",
  remainingDue,
  onContinueSession,
}: PracticeBoardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const now = useLiveNow();
  const [order, setOrder] = useState<PracticeOrder>("in-order");
  // Bumped each time the user (re-)selects Shuffle so repeated presses reshuffle
  // deterministically without depending on Math.random().
  const [seed, setSeed] = useState(0);
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Set once every verse has spent its turn and the learner dismisses the last
  // result, so the run ends on a summary instead of a dead card.
  const [finished, setFinished] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<
    ReviewSessionAttempt[]
  >([]);

  const { recordWithSeqAdopt } = useVersePracticeAttempt(recordModeFor(kind));
  const sessionLabel = sessionLabelFor(kind);
  const isReview = kind === "review";

  // Snapshot the practice set once when the board mounts. Like ReviewPlayer
  // freezing its due queue, this keeps mid-session heart changes (which mutate
  // the live `verses` prop) from swapping the verse at the current index —
  // especially dangerous under Shuffle, where the order would silently shift.
  const [baseVerses] = useState<OrderedVerse[]>(() =>
    verses.map((verse) => ({
      id: verseRefKey(verse.reference),
      reference: verse.reference,
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
  // in-session (and graduation fills the journey bar to 100%).
  const [progressByVerseId, setProgressByVerseId] = useState<
    Record<string, VerseProgress>
  >(() =>
    Object.fromEntries(
      baseVerses.map((verse) => [
        verse.id,
        {
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

  const orderedVerses = useMemo(
    () => buildPracticeOrder(baseVerses, order, seed),
    [baseVerses, order, seed],
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
    [orderedVerses, progressByVerseId, now, kind],
  );

  const boundedIndex =
    orderedVerses.length === 0
      ? 0
      : Math.min(currentIndex, orderedVerses.length - 1);
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

  // Soft lock drives the card's "come back tomorrow" chrome; work-left drives
  // navigation, so a verse that graduates mid-session also hands off cleanly.
  const currentLocked = isLearningLocked(currentProgress, now);
  const currentHasWorkLeft = hasSessionWorkLeft(kind, currentProgress, now);

  // Fetch the active verse's text (cache-shared with PracticeCard) so the rail
  // and card can show a length-accurate journey bar via learningJourneyFraction.
  const { data: activeVerseData } = useEsvReference(
    currentVerse?.reference ?? null,
  );
  const currentWordCount = useMemo(
    () =>
      activeVerseData
        ? countVerseWords(activeVerseData.verses.map((v) => v.text).join(" "))
        : undefined,
    [activeVerseData],
  );

  useEffect(() => {
    if (!isShuffling) return;
    const timer = window.setTimeout(
      () => setIsShuffling(false),
      SHUFFLE_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isShuffling, shuffleNonce]);

  function handleOrderChange(nextOrder: PracticeOrder) {
    setOrder(nextOrder);
    if (nextOrder === "shuffle") {
      setSeed((value) => value + 1);
      setShuffleNonce((value) => value + 1);
      if (!reduceMotion) setIsShuffling(true);
    } else {
      setIsShuffling(false);
    }
    setCurrentIndex(0);
  }

  function handleSelectVerse(id: string) {
    const index = orderedVerses.findIndex((verse) => verse.id === id);
    if (index >= 0) setCurrentIndex(index);
  }

  if (orderedVerses.length === 0 || !currentVerse) {
    return (
      <PracticeShell
        sessionLabel={sessionLabel}
        scopeLabel={scopeLabel}
        onExit={onExit}
        exitTooltip={exitTooltip}
      >
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No verses are available for {sessionLabel.toLowerCase()}.
          </p>
        </div>
      </PracticeShell>
    );
  }

  if (finished) {
    const averageAccuracy =
      sessionAttempts.length === 0
        ? null
        : Math.round(
            sessionAttempts.reduce(
              (acc, attempt) => acc + attempt.accuracy,
              0,
            ) / sessionAttempts.length,
          );
    const remaining = remainingDue ?? 0;

    return (
      <PracticeShell
        sessionLabel={sessionLabel}
        scopeLabel={scopeLabel}
        onExit={onExit}
        exitTooltip={exitTooltip}
      >
        {isReview ? (
          <ReviewSummary
            attempts={sessionAttempts}
            averageAccuracy={averageAccuracy}
            remaining={remaining}
            onDone={onExit}
            onContinue={
              remaining > 0 && onContinueSession ? onContinueSession : undefined
            }
            doneLabel={exitLabel}
          />
        ) : (
          <SessionComplete
            verses={railVerses}
            exitLabel={exitLabel}
            onExit={onExit}
          />
        )}
      </PracticeShell>
    );
  }

  return (
    <PracticeShell
      sessionLabel={sessionLabel}
      scopeLabel={scopeLabel}
      onExit={onExit}
      exitTooltip={exitTooltip}
    >
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
              position={boundedIndex}
              total={orderedVerses.length}
              showScheduleOutcome={isReview}
              onRecord={(tokens, wordCount) => {
                const verseId = currentVerse.id;
                const accuracy = verseAttemptAccuracy(tokens);
                if (isReview) {
                  const refKey = referenceKey(currentVerse.reference);
                  setSessionAttempts((prev) => {
                    const idx = prev.findIndex(
                      (attempt) => referenceKey(attempt.reference) === refKey,
                    );
                    const nextAttempt = {
                      reference: currentVerse.reference,
                      accuracy,
                    };
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = nextAttempt;
                      return next;
                    }
                    return [...prev, nextAttempt];
                  });
                }
                return recordWithSeqAdopt(
                  verseId,
                  {
                    reference: currentVerse.reference,
                    tokens,
                    stage: currentProgress.learnStage,
                    wordCount,
                  },
                  (next) => {
                    setProgressByVerseId((prev) => ({
                      ...prev,
                      [verseId]: {
                        learnStage: next.learnStage,
                        stageReps: next.stageReps,
                        status: next.status,
                        dueAt: next.dueAt ?? now,
                        lastReviewedAt: Date.now(),
                      },
                    }));
                  },
                );
              }}
              advancesOnContinue={!currentHasWorkLeft}
              onContinueAfterResult={() => {
                // A spent verse (learning lock, or a review that just
                // rescheduled) should hand off to the next verse that still
                // has a session left rather than parking on a dead end.
                if (currentHasWorkLeft) return;
                const nextAvailable = railVerses.findIndex(
                  (verse, index) => index !== boundedIndex && !verse.locked,
                );
                if (nextAvailable >= 0) {
                  setCurrentIndex(nextAvailable);
                  return;
                }
                setFinished(true);
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
        <div className="order-1 md:order-2">
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
            currentWordCount={currentWordCount}
            currentLocked={currentLocked}
          />
        </div>
      </div>
    </PracticeShell>
  );
}

interface PracticeCardProps {
  sessionLabel: MemorySessionLabel;
  reference: CardReference;
  /** Server-authoritative band for this verse (0..3). */
  learnStage: number;
  /** Server-authoritative exact reps banked on the current band. */
  stageReps: number;
  /** Lifecycle status — fills the journey bar on graduation. */
  status: MemoryStatus;
  /** Live SM-2 snapshot used to preview the next review interval on Check. */
  scheduleSnapshot: MemoryScheduleSnapshot;
  /** Soft-locked: today's learning session is done. */
  locked: boolean;
  position: number;
  total: number;
  /** Review mode: show schedule-consequence copy above the diff. */
  showScheduleOutcome?: boolean;
  onRecord: (
    tokens: ReturnType<typeof diffWords>,
    wordCount: number,
  ) => Promise<MemorySchedule | null>;
  /**
   * This verse is spent for the session, so dismissing the result leaves the
   * card instead of setting up another rep.
   */
  advancesOnContinue?: boolean;
  /** Fired when the learner dismisses a checked attempt's result. */
  onContinueAfterResult?: () => void;
}

function PracticeCard({
  sessionLabel,
  reference,
  learnStage,
  stageReps,
  status,
  scheduleSnapshot,
  locked,
  position,
  total,
  showScheduleOutcome = false,
  onRecord,
  advancesOnContinue = false,
  onContinueAfterResult,
}: PracticeCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  // Whether the current answer has been checked (and thus recorded). Persists
  // through the resulting band/rep change so the feedback stays visible until
  // the learner continues.
  const [checked, setChecked] = useState(false);
  const [nextSchedule, setNextSchedule] = useState<MemorySchedule | null>(null);
  const [outcomeNow, setOutcomeNow] = useState(() => Date.now());
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const reviewActionRef = useRef<HTMLButtonElement>(null);
  // Serializes attempt submission for this card: the synchronous in-flight lock
  // collapses same-tick double activations (double-tap, touch+mouse, Enter +
  // click) into a single recorded attempt, and `submitPending` disables the
  // control while it's in flight. One lock suffices because only one submit
  // path (Read prime *or* check-answer) is mounted at a time.
  const { submit, pending: submitPending } = useSubmitLock();

  const refLabel = formatVerseRef(reference);
  const { data, loading, error } = useEsvReference(reference);
  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";

  const stageInfo = PRACTICE_STAGES[learnStage] ?? PRACTICE_STAGES[0];
  const stageColor = practiceChromeFor(learnStage, status);
  const { hintStage, tokens, wordCount } = useMemo(() => {
    const wc = countVerseWords(versePlainText);
    const hint = hintForProgress(learnStage, stageReps, wc);
    return {
      hintStage: hint.stage,
      tokens: maskVerseText(versePlainText, hint.stage, {
        density: hint.density,
        seed: hint.seed,
      }),
      wordCount: wc,
    };
  }, [versePlainText, learnStage, stageReps]);

  const requiredToday = requiredRepsFor(learnStage, wordCount);
  const sessionGoalLabel =
    status === "reviewing" || status === "mastered"
      ? null
      : `${stageInfo.label} · ${Math.min(stageReps, requiredToday)} of ${requiredToday} today`;

  // A session-ending clear locks the verse the instant its attempt is adopted.
  // Hold the graded result until the learner continues so the feedback they
  // just earned isn't swapped out from under them.
  const showLocked = locked && !checked;

  const isReadPrime = hintStage === "full";
  const promptLine = showLocked
    ? "Done for today — come back tomorrow"
    : isReadPrime
      ? "Read it through, then continue"
      : hintStage === "hidden"
        ? "Recall the verse from memory"
        : "Type what you remember";

  const canCheckAnswer =
    !locked &&
    !loading &&
    !error &&
    typedAnswer.trim().length > 0 &&
    versePlainText !== "";
  const canContinueRead =
    !locked && !loading && !error && versePlainText !== "";
  const checkedDiffTokens = useMemo(
    () => (checked ? diffWords(typedAnswer, versePlainText) : []),
    [checked, typedAnswer, versePlainText],
  );
  const checkedAccuracy = verseAttemptAccuracy(checkedDiffTokens);
  const checkedQuality = classifyVerseAttempt(checkedDiffTokens);
  const madeLearningProgress =
    checkedQuality !== null &&
    isLearningProgressAttempt(checkedQuality, checkedAccuracy, learnStage);
  // Once graduated, another strong recall is just another practice pass — offer
  // "Try again" instead of implying the learning journey still advances. Review
  // spends the verse after a grade (`advancesOnContinue`), so that path shows
  // Continue toward the next due verse or the summary instead.
  const offerPracticeAgain =
    !advancesOnContinue &&
    (status === "reviewing" || status === "mastered" || !madeLearningProgress);

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
    // Practice counts fully: every checked attempt records and reschedules. The
    // lock keeps a double-tap from recording twice before the result view
    // (driven by `checked`) mounts and replaces this button.
    submit(async () => {
      const now = Date.now();
      const tokens = diffWords(typedAnswer, versePlainText);
      const quality = classifyVerseAttempt(tokens);
      const accuracy = verseAttemptAccuracy(tokens);
      // Preview the next interval locally so the result banner never flashes
      // "soon" while `recordAttempt` is in flight. Server schedule still wins
      // when it lands.
      const preview =
        showScheduleOutcome && quality
          ? previewNextSchedule(scheduleSnapshot, {
              quality,
              accuracy,
              mode: "review",
              now,
              wordCount: wordCount ?? 0,
              tzOffsetMinutes: new Date(now).getTimezoneOffset(),
            })
          : null;
      setChecked(true);
      setOutcomeNow(now);
      setNextSchedule(preview);
      const schedule = await onRecord(tokens, wordCount ?? 0);
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

  function continueAttempt() {
    setChecked(false);
    setTypedAnswer("");
    onContinueAfterResult?.();
    window.requestAnimationFrame(() => answerInputRef.current?.focus());
  }

  useEffect(() => {
    if (!checked) return;
    reviewActionRef.current?.focus();
  }, [checked]);

  useEffect(() => {
    if (!checked) return;
    function handleResultEnter(event: globalThis.KeyboardEvent) {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toUpperCase();
        // Let editable fields handle their own Enter.
        if (
          tag === "TEXTAREA" ||
          tag === "INPUT" ||
          (active as HTMLElement).isContentEditable
        )
          return;
        // Let other interactive controls (buttons, links, role=button/link)
        // activate naturally — only intercept when focus is on reviewActionRef
        // itself (or nowhere interactive).
        const role = active.getAttribute("role") ?? "";
        const isInteractive =
          tag === "BUTTON" ||
          tag === "A" ||
          role === "button" ||
          role === "link";
        if (isInteractive && active !== reviewActionRef.current) return;
      }
      event.preventDefault();
      reviewActionRef.current?.click();
    }
    window.addEventListener("keydown", handleResultEnter);
    return () => window.removeEventListener("keydown", handleResultEnter);
  }, [checked]);

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

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
            <CardTitle className="mt-2 text-3xl tracking-tight">
              {refLabel}
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Verse {position + 1} of {total}
          </p>
          <p className={cn("text-xs font-medium", stageColor.text)}>
            {promptLine}
          </p>
          {sessionGoalLabel && !locked ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {sessionGoalLabel}
            </p>
          ) : null}
          <LearningJourneyBar
            learnStage={learnStage}
            stageReps={stageReps}
            wordCount={wordCount}
            status={status}
          />
          {locked ? (
            <p className="text-xs text-muted-foreground">
              Next session tomorrow · {stageInfo.label} waiting
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5">
          {showLocked ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border bg-background/75 px-5 py-8 text-center">
              <CheckCircle2
                className={cn("h-8 w-8", stageColor.text)}
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">
                Done for today
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                You finished this verse&apos;s learning session. Come back
                tomorrow to continue with {stageInfo.label}.
              </p>
            </div>
          ) : (
            <>
              {!checked && (
                <>
                  <div
                    className={cn(
                      "min-h-[220px] rounded-xl border bg-background/75 px-5 py-5 text-left text-lg leading-8",
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
                      <p className="text-sm text-destructive">
                        Could not load verse text.
                      </p>
                    ) : hintStage === "hidden" ? (
                      <div className="flex h-full min-h-[140px] items-center justify-center text-center">
                        <p className="max-w-sm text-sm text-muted-foreground">
                          No hint text. Type the verse from memory, then check
                          your answer.
                        </p>
                      </div>
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
                      placeholder="Type what you remember"
                      className="min-h-[170px] resize-none bg-background/80"
                      aria-label="Your recalled verse"
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
                    nextSchedule={nextSchedule}
                    now={outcomeNow}
                  />
                  <p className="text-center text-sm text-muted-foreground">
                    {`${checkedAccuracy}% recalled.`}
                  </p>
                  {checkedQuality !== "exact" && (
                    <div className="rounded-xl border bg-card/60 px-4 py-3 text-left text-sm leading-6">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Full text
                      </p>
                      {data?.verses.map((verse) => (
                        <p key={verse.number}>
                          <span className="mr-1 align-top text-xs font-semibold text-muted-foreground">
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
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {!showLocked && !checked && !isReadPrime ? (
              <PreviewFillExactAnswerButton
                versePlainText={versePlainText}
                onFill={setTypedAnswer}
                disabled={loading || Boolean(error)}
              />
            ) : null}
            {showLocked ? null : checked ? (
              <Button
                ref={reviewActionRef}
                type="button"
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={continueAttempt}
                // Hold until the attempt settles: this both keeps the submit
                // lock from swallowing the next check (resetting the question
                // mid-flight would strand it) and ensures the adopted band/reps
                // land before the next rep renders, so it can't re-record stale.
                disabled={submitPending}
              >
                {offerPracticeAgain ? (
                  <RotateCcw className="h-4 w-4" aria-hidden />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                )}
                {offerPracticeAgain ? "Try again" : "Continue"}
              </Button>
            ) : isReadPrime ? (
              <Button
                type="button"
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={continueRead}
                disabled={!canContinueRead || submitPending}
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={checkAnswer}
                disabled={!canCheckAnswer}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Check answer
              </Button>
            )}
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
  const refLabel = formatVerseRef(verse.reference);
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
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
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
  exitTooltip = "Go back to the Memory dashboard",
  children,
}: {
  sessionLabel: MemorySessionLabel;
  scopeLabel: string;
  onExit: () => void;
  exitTooltip?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="-ml-2 shrink-0 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            </TooltipTrigger>
            <TooltipContent>{exitTooltip}</TooltipContent>
          </Tooltip>
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg tracking-tight">
            <span className="shrink-0 font-semibold">{sessionLabel}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="truncate font-medium text-muted-foreground">
              {scopeLabel}
            </span>
          </h1>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-6">{children}</div>
      </ScrollArea>
    </div>
  );
}
