import {
  type JSX,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useMutation } from "convex/react";

import { PassageCompleteMoment } from "@/components/memory/celebrate/passage-complete-moment";
import { useFirstMasteredToast } from "@/components/memory/celebrate/use-milestone-hint";
import {
  PassageRecallCard,
  type PassageRecallHint,
  type PassageRecallResult,
  type PassageRecallResultView,
} from "@/components/memory/passage/passage-recall-card";
import {
  chromeStage,
  computeStallCue,
  type StallCueContent,
  CONNECT_COPY,
  CONNECT_RECITE_LABEL,
  connectPairTitle,
  DONE_FOR_NOW_LABEL,
  BUDGET_EXHAUSTED_COPY,
  FRONTIER_LOCKED_COPY,
  frontierHint,
  NEXT_VERSE_PROMPT_COPY,
  PRACTICE_ROPE_PROMPT_COPY,
  PRACTICE_WHAT_YOU_KNOW_LABEL,
  START_VERSE_PROMPT_COPY,
  WARMUP_PROMPT_COPY,
  WARMUP_SKIP_LABEL,
  hasStartedPassage,
  joinPieceTexts,
  latestLockedPiece,
  nextUnreachedPiece,
  PASSAGE_SESSION_PHASE_LABELS,
  pieceCardTitle,
  pieceReference,
  pieceStatus,
  pickUpCue,
  refreshPieceIndexes,
  verseScores,
  stopBeforeCue,
  RECITE_IT_ALL_LABEL,
  remainingAddsIn,
  repairPromptIndexes,
  ropeWindowPieceIndexes,
  SECTION_COMPLETE_COPY,
  SECTION_RECITE_LABEL,
  sectionIndexes,
  sessionFromView,
  tzOffsetMinutesAt,
  verseCountIn,
  windowTitle,
  type RopeStartOverride,
} from "@/components/memory/passage/passage-session-model";
import type { PassageView } from "@/components/memory/passage/passage-session-types";
import { useCarriedOverNotice } from "@/components/memory/passage/use-carried-over-notice";
import {
  PassageReviewSummary,
  type ReviewSessionAttempt,
} from "@/components/memory/review-summary";
import type { SessionSummarySnapshot } from "@/hooks/use-start-verse-refresh";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { MEMORY_HOME } from "@/lib/memory-exit";
import { PRACTICE_STAGES } from "@/components/memory/practice/practice-stages";
import {
  useVerseRefresher,
  type VerseRefresherPhase,
} from "@/components/memory/practice/use-verse-refresher";
import { SessionColumns } from "@/components/memory/practice/session-columns";
import {
  SessionHeaderProgress,
  type SessionProgress,
} from "@/components/memory/practice/session-header-progress";
import type { VerseAttemptQuality } from "@/components/study/study-attempt-quality";
import { SessionBackButton } from "@/components/memory/session-back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useEsvCompositePassage,
  type CompositePassageSegment,
} from "@/hooks/use-esv-composite-passage";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  compositeHintForWindow,
  dueFrontierIndex,
  localDayIndex,
  rehearsalStartIndex,
  remainingIntroduces,
  ropePieceIndexes,
  sectionStartIndex,
} from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";
import {
  reducePassageSession,
  reconcilePassagePhase,
  type PassageSessionPhase,
  type PassageSessionState,
} from "@/lib/passage-session";
import {
  clearPassageStepInProgress,
  markPassageStepInProgress,
  releasePassageStepInProgress,
} from "@/lib/passage-step-resume";
import { formatDueDay } from "@/lib/memorize-plan";
import {
  COUNTED_TODAY_CLOSING,
  NEED_A_REFRESHER_LABEL,
  NEED_A_REFRESHER_PASSAGE_TOOLTIP,
  NOW_TRY_WITHOUT_HINTS,
  PRACTICE_ONLY_CLOSING,
  REFRESH_SAVE_ERROR,
  refresherHeader,
  TRY_ANOTHER_REFRESHER_LABEL,
} from "@/lib/memory-copy";
import { isDueForReview } from "@/lib/memory-scheduler";
import { previewNextSchedule } from "@/lib/memory-schedule-preview";
import { PASSAGE_PASS_ACCURACY } from "@/lib/passage-frontier";
import {
  missedVerses,
  type PassageVerseKey,
  type PassageVerseScore,
} from "@/lib/passage-shaky";
import {
  firstLettersHintText,
  passageVersesIn,
  usePassageReview,
  usePassageStale,
  type ReviewSave,
} from "@/components/memory/passage/use-passage-review";
import { countVerseWords, seededRandom } from "@/lib/verse-hint";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type BuiltRecall = {
  mode: "rope" | "repair" | "frontier" | "review";
  /** A rope recital's pieces, the range a Learning refresher hints. */
  pieceIndexes?: readonly number[];
  title: string;
  subtitle?: string;
  promptLine: string;
  versePlainText: string;
  loading: boolean;
  error: string | null;
  retry: () => void;
  hint: PassageRecallHint;
  /** End of the verse before this recall when it starts mid-passage. */
  pickUpCue: StallCueContent | null;
  /** Start of the verse after this recall when it is typed from memory. */
  stopBeforeCue: string | null;
  learnStage: number;
  stageReps: number;
  status: "learning" | "reviewing";
  showJourneyBar: boolean;
  readContinue: boolean;
};

/**
 * This session's counted tries, as a verse session records them for its
 * summary (a replaced first try, then the From memory try), and the passage's
 * next due date and status after them.
 */
type SavedReview = {
  attempts: ReviewSessionAttempt[];
  dueAt: number;
  status?: PassageView["status"];
};

/** A passage summary kept on its history entry, shown again as it was. */
export type PassageSummarySnapshot = Extract<
  SessionSummarySnapshot,
  { kind: "passage" }
>;

const SAVE_ATTEMPT_ERROR = "Couldn't save that attempt. Please try again.";
const FROM_MEMORY_PASSAGE_HINT =
  "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.";
const TYPE_THIS_PART_PROMPT = "Type this part from memory";

interface PassageSessionProps {
  packId: Id<"packs">;
  view: PassageView;
  packName: string;
  onExit: () => void;
  /**
   * "That's enough for today". Defaults to `onExit`. Global Learn uses this
   * to remember the pack was dismissed without treating the header Back the
   * same way.
   */
  onDoneForToday?: () => void;
  /** Header back button text, e.g. "Back to Memory". */
  backLabel?: string;
  /** Where Back goes. Home shows when this is not `/memory`. */
  exitHref?: string;
  /**
   * Header text and overall bar when this passage is one part of a session.
   * A function gets the share of today's new verses added so far.
   */
  progress?: SessionProgress | ((todayShare: number) => SessionProgress);
  /** A side column beside the passage, e.g. the rest of today's queue. */
  aside?: ReactNode;
  /**
   * Standalone Review: Continue after a saved review ends the session with a
   * summary instead of reciting the passage again.
   */
  endsAfterReview?: boolean;
  /**
   * ••• or summary Refresh on a passage: opens in the refresher. From
   * Review, its From memory try counts when a Memorized passage is due (R30);
   * from Practice it never does (R50, R51). On a Learning passage it covers
   * only the learned verses and saves nothing (R39). Continue on that result
   * leaves with `onExit`.
   */
  refresh?: "review" | "practice";
  /** Coming back from a summary Refresh: that summary, as it was. */
  restoredSummary?: PassageSummarySnapshot;
}

export function PassageSession({
  packId,
  view,
  packName,
  onExit,
  onDoneForToday,
  backLabel = "Back to Memory",
  exitHref,
  progress,
  aside,
  endsAfterReview = false,
  refresh,
  restoredSummary,
}: PassageSessionProps): JSX.Element {
  const now = useLiveNow();
  const tzOffsetMinutes = tzOffsetMinutesAt(now);
  const timeZone = getViewerTimeZone();
  const introduceNext = useMutation(api.passageMemory.introduceNext);
  const recordAttempt = useMutation(api.passageMemory.recordAttempt);

  const [status, setStatus] = useState(view.status);
  const isMaintenance = status === "reviewing" || status === "mastered";
  // A Learning passage's ••• Refresh (S14): only the verses learned when it
  // opened (R39), practice only, and nothing in it is saved.
  const [learnedWindow] = useState(() =>
    refresh !== undefined && view.status === "building"
      ? refreshPieceIndexes(view.status, view.pieces)
      : null,
  );
  // The Learning session itself, as opposed to a review or a Refresh.
  const learning = !isMaintenance && learnedWindow === null;
  // Opened on a Memorized passage that is not due (Practice anytime): every
  // try and refresher is practice only, and Continue leaves (R40).
  const [practiceSession] = useState(
    () =>
      (view.status === "reviewing" || view.status === "mastered") &&
      !isDueForReview({ status: view.status, dueAt: view.dueAt }, now),
  );

  const [state, setState] = useState<PassageSessionState>(() =>
    sessionFromView(view, now, tzOffsetMinutes, undefined, timeZone),
  );

  const endStep = () => {
    if (learnedWindow === null) clearPassageStepInProgress(packId);
  };
  const leaveSession = () => {
    endStep();
    onExit();
  };
  const finishForToday = () => {
    endStep();
    (onDoneForToday ?? onExit)();
  };
  const [addsAtOpen] = useState(() => remainingAddsIn(state));
  const headerProgress =
    typeof progress === "function"
      ? progress(
          addsAtOpen > 0
            ? Math.min(
                Math.max((addsAtOpen - remainingAddsIn(state)) / addsAtOpen, 0),
                1,
              )
            : 0,
        )
      : progress;
  const [introduceBusy, setIntroduceBusy] = useState(false);
  const [ropeOverride, setRopeOverride] =
    useState<RopeStartOverride>("rehearsal");
  const [stallCue, setStallCue] = useState<StallCueContent | null>(null);
  const [holdResult, setHoldResult] = useState(false);
  const [heldRecall, setHeldRecall] = useState<BuiltRecall | null>(null);
  const [recitingSection, setRecitingSection] = useState(false);
  const [recitingConnect, setRecitingConnect] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [savedReview, setSavedReview] = useState<SavedReview | null>(null);
  const [finishedReview, setFinishedReview] = useState<SavedReview | null>(
    restoredSummary ?? null,
  );
  // Memorized review refresher. A cold miss on a due passage is held on the
  // server (as S5 holds a verse): Continue, leaving, the next load or the
  // backstop counts it, and only a finished From memory try replaces it. Its
  // weak verses are hinted right away.
  const refresher = useVerseRefresher(
    learnedWindow
      ? "practice"
      : refresh === undefined || !isMaintenance
        ? undefined
        : refresh === "review" &&
            isDueForReview({ status, dueAt: view.dueAt }, now)
          ? "pre-try"
          : "practice",
  );
  const [reviewDueAt, setReviewDueAt] = useState(view.dueAt);
  const [shakyVerses, setShakyVerses] = useState<PassageVerseKey[]>(
    view.shakyVerses ?? [],
  );
  const review = usePassageReview();
  const [resultView, setResultView] = useState<PassageRecallResultView | null>(
    null,
  );
  /** Try again on a failed save resends this, with the same result. */
  const retrySaveRef = useRef<(() => Promise<void>) | null>(null);
  // The passage just became known by heart: "pending" holds the moment until
  // the learner continues past the result that finished it. "owed" is a moment
  // missed by leaving early, shown once this session opens with its text.
  const [moment, setMoment] = useState<"pending" | "showing" | "owed" | null>(
    view.needsCelebration ? "owed" : null,
  );
  const celebrateMastered = useFirstMasteredToast();
  const carriedOver = useCarriedOverNotice(view._id, state.pieces, learning);

  const pieceRefs = useMemo(
    () => view.pieces.map(pieceReference),
    [view.pieces],
  );
  // A Refresh loads only what it covers. The learned window is the rope, a
  // prefix, so its segments still line up with `view.pieces` by index.
  const composite = useEsvCompositePassage(
    learnedWindow ? pieceRefs.slice(0, learnedWindow.length) : pieceRefs,
    { enabled: view.pieces.length > 0 },
  );
  const pieceTexts = useMemo(
    () => view.pieces.map((_, index) => composite.segments[index]?.text ?? ""),
    [view.pieces, composite.segments],
  );
  // The same text verse by verse, so each verse is scored and hinted on its
  // own even inside a multi-verse piece.
  const passageVerses = useMemo(
    () => passageVersesIn(composite.segments),
    [composite.segments],
  );
  const pieceWordCounts = useMemo(
    () => pieceTexts.map((text) => countVerseWords(text)),
    [pieceTexts],
  );
  const wordCountsReady =
    composite.segments.length === view.pieces.length &&
    !composite.loading &&
    composite.error === null;

  const ropeIndexes = ropeWindowPieceIndexes(
    state.pieces,
    recitingSection ? "section" : ropeOverride,
    wordCountsReady ? pieceWordCounts : undefined,
  );
  const reviewDue =
    isMaintenance && isDueForReview({ status, dueAt: reviewDueAt }, now);
  // Undefined until the recent reviews load.
  const staleCheck = usePassageStale(
    isMaintenance
      ? {
          packId,
          status,
          dueAt: reviewDueAt,
          intervalDays: view.intervalDays,
          startedOverAt: view.startedOverAt,
        }
      : null,
    now,
  );
  const stale = staleCheck === true;
  const liveRecall =
    isMaintenance || learnedWindow
      ? reviewRecall(
          packName,
          state.pieces,
          learnedWindow ?? state.pieces.map((_, index) => index),
          pieceTexts,
          composite,
          {
            phase: refresher.phase,
            seed: refresher.seed,
            everyWordVerses: refresher.everyWordVerses,
            targets: review.hintTargets(shakyVerses),
            segments: composite.segments,
          },
        )
      : buildingRecall({
          packName,
          state,
          recitingSection,
          recitingConnect,
          pieceTexts,
          compositeLoading: composite.loading,
          compositeError: composite.error,
          retry: composite.retry,
          ropeIndexes,
        });
  // A Learning passage refreshes only its warm-up and section recital (R32,
  // R37): never the new verse, Fix a tricky spot or Connect (R31, R38).
  const learningRefreshable =
    learning &&
    (state.phase === "rope" ||
      (state.phase === "section-complete" && recitingSection));
  // The card being refreshed: the held result after a logged miss, or the
  // unattempted card before a try. Its own state is left as it was.
  const shownRecall = holdResult && heldRecall ? heldRecall : liveRecall;
  // The Learning refresher's range, verse by verse, to hint and score.
  const learningRefresherSegments =
    learning && shownRecall
      ? (shownRecall.pieceIndexes ?? []).flatMap((index) => {
          const segment = composite.segments[index];
          return segment ? [segment] : [];
        })
      : [];
  const recall =
    learning && refresher.isOpen && shownRecall
      ? learningRefresherRecall(shownRecall, {
          phase: refresher.phase,
          seed: refresher.seed,
          everyWordVerses: refresher.everyWordVerses,
          segments: learningRefresherSegments,
        })
      : shownRecall;
  // A logged miss's starting hint is for its next try, not the refresher.
  const cue = (refresher.isOpen ? null : stallCue) ?? recall?.pickUpCue ?? null;

  const autoIntroduceStarted = useRef(false);
  // The day's step starts once warm-up ends. Until then (warm-up, or a
  // stall-repair inside it) a reload restarts the warm-up, so leave no marker.
  const dayStepStarted = useRef(false);
  // A 100% From memory in the warm-up's refresher counts as the warm-up, even
  // after a logged miss: its Continue ends the warm-up, still saving nothing.
  const refresherPassedWarmup = useRef(false);

  useEffect(() => {
    // A Refresh is no step of the Learning session: it leaves the marker be.
    if (learnedWindow) return;
    if (state.phase === "passage-complete") {
      clearPassageStepInProgress(packId);
      return;
    }
    if (state.phase !== "rope" && state.phase !== "stall-repair") {
      dayStepStarted.current = true;
    }
    if (!dayStepStarted.current) return;
    markPassageStepInProgress(packId);
    return () => {
      releasePassageStepInProgress(packId);
    };
  }, [packId, state.phase, learnedWindow]);

  async function persist(
    next: PassageSessionState,
    quality: VerseAttemptQuality | undefined,
    durationMs?: number,
  ): Promise<boolean> {
    const pending = next.pendingMutation;
    if (!pending) {
      setState(next);
      setPersistError(null);
      return true;
    }
    const attemptedAt = Date.now();
    const tz = tzOffsetMinutesAt(attemptedAt);
    const zone = getViewerTimeZone();
    try {
      if (pending.name === "introduceNext") {
        const nextView = await introduceNext({
          packId,
          now: attemptedAt,
          tzOffsetMinutes: tz,
        });
        setStatus(nextView.status);
        setState({
          ...next,
          pieces: nextView.pieces,
          addsOnDay: nextView.addsOnDay,
          addDayKey: nextView.addDayKey,
          now: attemptedAt,
          pendingMutation: undefined,
        });
        setPersistError(null);
        return true;
      }
      if (!quality) return false;
      const nextView = await recordAttempt({
        packId,
        kind: pending.kind,
        quality,
        accuracy: pending.accuracy,
        now: attemptedAt,
        tzOffsetMinutes: tz,
        timeZone: zone,
        durationMs,
        pieceIndex: pending.pieceIndex,
        wordCount:
          pending.kind === "frontier"
            ? (next.pieceWordCounts?.[pending.pieceIndex ?? 0] ?? undefined)
            : undefined,
      });
      adoptView(next, nextView, attemptedAt);
      setPersistError(null);
      return true;
    } catch {
      setPersistError(
        pending.name === "introduceNext"
          ? "Couldn't start the next verse. Please try again."
          : SAVE_ATTEMPT_ERROR,
      );
      return false;
    }
  }

  function adoptView(
    next: PassageSessionState,
    nextView: PassageView,
    attemptedAt: number,
  ) {
    const remaining = remainingIntroduces({
      addsOnDay: nextView.addsOnDay,
      addDayKey: nextView.addDayKey,
      todayKey: localDayIndex(attemptedAt, tzOffsetMinutesAt(attemptedAt)),
    });
    if (status === "building" && nextView.needsCelebration) {
      setMoment("pending");
    }
    if (status !== "mastered" && nextView.status === "mastered") {
      celebrateMastered(packName);
    }
    setStatus(nextView.status);
    setShakyVerses(nextView.shakyVerses ?? []);
    setState({
      ...next,
      pieces: nextView.pieces,
      addsOnDay: nextView.addsOnDay,
      addDayKey: nextView.addDayKey,
      now: attemptedAt,
      pendingMutation: undefined,
      phase: reconcilePassagePhase(
        next.phase,
        nextView.pieces,
        remaining,
        attemptedAt,
      ),
    });
  }

  /** Add counted tries to the summary, the way a verse session does. */
  function adoptReview(
    accuracies: number[],
    { dueAt, status: nextStatus }: Pick<PassageView, "dueAt" | "status">,
    refresherUsed = false,
  ) {
    const attempts = accuracies.flatMap(
      (accuracy, index): ReviewSessionAttempt[] =>
        pieceRefs[0]
          ? [
              {
                reference: pieceRefs[0],
                label: packName,
                accuracy,
                offerPractice: false,
                ...(refresherUsed && index === accuracies.length - 1
                  ? { refresherUsed: true }
                  : {}),
              },
            ]
          : [],
    );
    const saved = {
      attempts: [...(savedReview?.attempts ?? []), ...attempts],
      dueAt,
      status: nextStatus,
    };
    setSavedReview(saved);
    setReviewDueAt(dueAt);
    return saved;
  }

  /**
   * Save a counted review try; a From memory try after a held miss replaces
   * it. Resolves its next due date, or null on failure.
   */
  async function saveReview(
    save: ReviewSave,
    replaceHeld = false,
  ): Promise<number | null> {
    try {
      const { view: nextView, replaced } = await review.record(
        packId,
        save,
        replaceHeld,
      );
      // A From memory try that replaces a held miss keeps both tries.
      adoptReview(
        replaced ? [replaced.accuracy, save.accuracy] : [save.accuracy],
        nextView,
        save.refresherUsed === true,
      );
      adoptView(state, nextView, save.now);
      return nextView.dueAt;
    } catch {
      return null;
    }
  }

  /** Hold a cold miss on the server. Nothing counts until it is applied. */
  async function holdReviewMiss(
    save: ReviewSave,
    shown: PassageRecallResultView,
  ) {
    retrySaveRef.current = () => holdReviewMiss(save, shown);
    try {
      await review.hold(packId, save);
      retrySaveRef.current = null;
      setResultView(shown);
    } catch {
      setResultView({ tryAgain: true, saveError: REFRESH_SAVE_ERROR });
    }
  }

  async function saveCountedRefresher(save: ReviewSave, replaceHeld: boolean) {
    retrySaveRef.current = () => saveCountedRefresher(save, replaceHeld);
    const dueAt = await saveReview(save, replaceHeld);
    if (dueAt === null) {
      setResultView({ tryAgain: true, saveError: REFRESH_SAVE_ERROR });
      return;
    }
    retrySaveRef.current = null;
    setResultView({
      closingLine: nextReviewLine(dueAt, save.now),
      countedLine: refresh ? COUNTED_TODAY_CLOSING : null,
      offer:
        save.accuracy < PASSAGE_PASS_ACCURACY
          ? tryAnotherRefresher(openRefresher)
          : undefined,
    });
  }

  function openRefresher(kind: "pre-try" | "after-miss" | "practice") {
    setResultView(null);
    // A Learning passage keeps its logged result held under the refresher, so
    // Continue still leads where that try led.
    if (isMaintenance) {
      setHoldResult(false);
      setHeldRecall(null);
    }
    refresher.open(kind);
  }

  /**
   * A First letters try saves nothing. Step 1 always continues (no Try
   * again), into an every-word step on its verses under 85% when there are
   * any; the every-word step offers Try again under 85%, as today.
   */
  function gradeFirstLetters(
    scores: readonly PassageVerseScore[],
    missed: boolean,
  ) {
    if (refresher.phase === "step1") {
      const weak = missedVerses(scores);
      if (weak.length > 0) refresher.needEveryWord(weak);
    }
    setResultView({
      firstLetters: true,
      tryAgain: refresher.phase === "every-word" && missed,
    });
  }

  /** A Memorized passage's typed try, cold or inside the refresher. */
  async function gradeReview(result: PassageRecallResult): Promise<boolean> {
    const save: ReviewSave = {
      quality: result.quality,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
      now: Date.now(),
      verseScores: verseScores(result.tokens, passageVerses),
    };
    const missed = result.accuracy < PASSAGE_PASS_ACCURACY;

    if (refresher.firstLetters) {
      gradeFirstLetters(save.verseScores, missed);
      return true;
    }
    if (refresher.kind === "practice" || practiceSession) {
      // Clearing shaky verses is a bonus; the practice result stands.
      const nextView = await review.notePractice(packId, save);
      if (nextView) setShakyVerses(nextView.shakyVerses ?? []);
      // Try another's From memory after a counted try: the summary row shows
      // it last, but it stays practice (no schedule, average, or Refresh).
      const reference = pieceRefs[0];
      if (reference) {
        setSavedReview(
          (current) =>
            current && {
              ...current,
              attempts: [
                ...current.attempts,
                {
                  reference,
                  label: packName,
                  accuracy: save.accuracy,
                  offerPractice: false,
                  displayOnly: true,
                },
              ],
            },
        );
      }
      setResultView({
        practiceOnly: true,
        closingLine: PRACTICE_ONLY_CLOSING,
        offer:
          refresher.isOpen && save.accuracy < 100
            ? tryAnotherRefresher(openRefresher)
            : undefined,
      });
      return true;
    }
    if (refresher.phase === "step2") {
      await saveCountedRefresher(
        { ...save, refresherUsed: true },
        refresher.kind === "after-miss",
      );
      return true;
    }
    if (missed && reviewDue) {
      const preview = previewNextSchedule(
        {
          status,
          learnStage: 3,
          stageReps: view.stageReps,
          dueAt: reviewDueAt,
          ease: view.ease,
          intervalDays: view.intervalDays,
          consecutiveCorrect: view.consecutiveCorrect,
          lapses: view.lapses,
          earlyReviewApplied: view.earlyReviewApplied,
        },
        {
          quality: save.quality,
          accuracy: save.accuracy,
          mode: "review",
          now: save.now,
          timeZone: getViewerTimeZone(),
          item: "passage",
        },
      );
      await holdReviewMiss(save, {
        closingLine: preview ? nextReviewLine(preview.dueAt, save.now) : null,
        offer: needARefresher(() => openRefresher("after-miss")),
        focusOffer: true,
      });
      return true;
    }

    if ((await saveReview(save)) === null) {
      setPersistError(SAVE_ATTEMPT_ERROR);
      return false;
    }
    setPersistError(null);
    setHoldResult(true);
    setHeldRecall(liveRecall);
    return true;
  }

  /** Continue (or Try again) on a result, or on a refresher step. */
  async function continueAfterResult(): Promise<boolean> {
    const retrySave = retrySaveRef.current;
    if (retrySave) {
      await retrySave();
      return false;
    }
    if (refresher.firstLetters) {
      const retry = resultView?.tryAgain === true;
      setResultView(null);
      if (!retry) refresher.continueToNext();
      return true;
    }
    if ((refresh && refresher.isOpen) || practiceSession) {
      // Straight back to where the Refresh or Practice anytime started, with
      // no summary or prompt flashing up while it goes.
      leaveSession();
      return false;
    }
    let saved = savedReview;
    if (!refresher.isOpen && review.heldMiss) {
      try {
        const applied = await review.applyHeld();
        if (applied?.view) {
          saved = adoptReview([applied.save.accuracy], applied.view);
          adoptView(state, applied.view, applied.save.now);
        }
      } catch {
        setResultView((current) => ({
          ...current,
          tryAgain: true,
          saveError: REFRESH_SAVE_ERROR,
        }));
        return false;
      }
    }
    const warmupDone = refresher.isOpen && refresherPassedWarmup.current;
    refresherPassedWarmup.current = false;
    refresher.close();
    setResultView(null);
    handleContinueAfterResult(saved);
    if (warmupDone) handleSkipWarmup();
    return true;
  }

  function withWordCounts(current: PassageSessionState): PassageSessionState {
    return {
      ...current,
      pieceWordCounts: wordCountsReady
        ? pieceWordCounts
        : current.pieceWordCounts,
    };
  }

  async function handleGraded(result: PassageRecallResult): Promise<boolean> {
    if (isMaintenance) return gradeReview(result);
    // A Learning passage's refresher is practice only: nothing is saved.
    if (refresher.firstLetters) {
      // S15 scores its warm-up or section range; S14's text is already just
      // the learned verses.
      gradeFirstLetters(
        verseScores(
          result.tokens,
          learning ? passageVersesIn(learningRefresherSegments) : passageVerses,
        ),
        result.accuracy < PASSAGE_PASS_ACCURACY,
      );
      return true;
    }
    if (refresher.isOpen) {
      // A Learning refresher is the warm-up's or the section recital's, before
      // a try or after a logged miss (R32, R37).
      refresherPassedWarmup.current =
        learning && !recitingSection && result.accuracy === 100;
      setResultView({
        practiceOnly: true,
        closingLine: PRACTICE_ONLY_CLOSING,
      });
      return true;
    }

    const next = reducePassageSession(withWordCounts(state), {
      type: "attempt",
      accuracy: result.accuracy,
      tokens: result.tokens,
      now: Date.now(),
    });
    const saved = await persist(next, result.quality, result.durationMs);
    if (!saved) return false;
    if (result.via === "typed" && liveRecall) {
      // Freeze hint/prompt chrome on the pre-check snapshot, but adopt the
      // post-attempt journey fields so the progress bar and step label move
      // as soon as the check qualifies.
      setHeldRecall(heldRecallWithJourneyProgress(liveRecall, next));
      setHoldResult(true);
    }
    setResultView(
      learningRefreshable && result.accuracy < PASSAGE_PASS_ACCURACY
        ? { offer: needARefresher(() => openRefresher("after-miss")) }
        : null,
    );
    setStallCue(computeStallCue(next, pieceTexts));
    return true;
  }

  async function handleIntroduce(): Promise<boolean> {
    if (introduceBusy) return false;
    setIntroduceBusy(true);
    try {
      const next = reducePassageSession(withWordCounts(state), {
        type: "introduce",
        now: Date.now(),
      });
      const saved = await persist(next, undefined);
      if (!saved) return false;
      setRopeOverride("rehearsal");
      setStallCue(null);
      setHoldResult(false);
      setHeldRecall(null);
      setRecitingSection(false);
      setRecitingConnect(false);
      return true;
    } finally {
      setIntroduceBusy(false);
    }
  }

  function handleContinueAfterResult(saved = savedReview) {
    if (endsAfterReview && saved) {
      setFinishedReview(saved);
      return;
    }
    if (moment === "pending") setMoment("showing");
    setHoldResult(false);
    setHeldRecall(null);
    if (state.phase !== "rope" && state.phase !== "stall-repair") {
      setRopeOverride("rehearsal");
    }
    if (state.phase !== "section-complete") {
      setRecitingSection(false);
    }
    if (state.phase !== "connect") {
      setRecitingConnect(false);
    }
  }

  function handleSkipWarmup() {
    const next = reducePassageSession(withWordCounts(state), {
      type: "continue",
      now: Date.now(),
    });
    setState(next);
    setHoldResult(false);
    setHeldRecall(null);
    setStallCue(null);
    setRopeOverride("rehearsal");
  }

  function handleSkipSection() {
    const next = reducePassageSession(withWordCounts(state), {
      type: "continue",
      now: Date.now(),
    });
    setState(next);
    setHoldResult(false);
    setHeldRecall(null);
    setStallCue(null);
    setRecitingSection(false);
    setRecitingConnect(false);
  }

  const remaining = remainingAddsIn(state);
  const effectivePhase = isMaintenance
    ? state.phase
    : reconcilePassagePhase(state.phase, state.pieces, remaining, state.now);
  const needsFirstVerse =
    learning &&
    effectivePhase === "offer-introduce" &&
    !hasStartedPassage(state.pieces);

  useEffect(() => {
    if (!needsFirstVerse || autoIntroduceStarted.current) return;
    autoIntroduceStarted.current = true;
    void handleIntroduce().then((saved) => {
      if (!saved) autoIntroduceStarted.current = false;
    });
    // Auto-start only the first verse of a new passage.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot
  }, [needsFirstVerse]);

  const phaseLabel = isMaintenance
    ? RECITE_IT_ALL_LABEL
    : liveRecall?.mode === "frontier"
      ? (PRACTICE_STAGES[liveRecall.learnStage]?.label ?? "Learn")
      : PASSAGE_SESSION_PHASE_LABELS[effectivePhase];

  const defaultRehearsalStart = rehearsalStartIndex(
    state.pieces,
    wordCountsReady ? pieceWordCounts : undefined,
  );
  const lastRope = ropePieceIndexes(state.pieces).at(-1) ?? 0;
  const showSectionStart =
    !isMaintenance &&
    effectivePhase === "rope" &&
    sectionStartIndex(state.pieces, lastRope) < defaultRehearsalStart;
  const showBeginningStart =
    !isMaintenance &&
    effectivePhase === "rope" &&
    (ropePieceIndexes(state.pieces)[0] ?? 0) < defaultRehearsalStart;

  const showNextVersePanel =
    learning &&
    !holdResult &&
    !needsFirstVerse &&
    effectivePhase === "offer-introduce";
  const showDoneToday =
    learning &&
    !holdResult &&
    (effectivePhase === "frontier-locked" ||
      effectivePhase === "budget-exhausted");
  const nextPiece = nextUnreachedPiece(state.pieces);
  const finishedPiece = latestLockedPiece(state.pieces, state.now);
  const showRecall =
    Boolean(recall) &&
    !finishedReview &&
    !showNextVersePanel &&
    !showDoneToday &&
    !needsFirstVerse;

  return (
    <PassageSessionShell
      // A Learning passage's Refresh names its step on the card only, with
      // no Learning phase (no warm-up chrome) in the header.
      phaseLabel={finishedReview || learnedWindow ? undefined : phaseLabel}
      packName={packName}
      onExit={leaveSession}
      onHome={endStep}
      backLabel={backLabel}
      exitHref={exitHref}
      progress={headerProgress}
      persistError={persistError}
      aside={aside}
    >
      {carriedOver.notice ? (
        <CarriedOverNotice
          notice={carriedOver.notice}
          onDismiss={carriedOver.dismiss}
        />
      ) : null}

      {needsFirstVerse ? (
        persistError ? (
          <NextVersePanel
            finishedTitle={null}
            nextTitle={
              nextPiece ? pieceCardTitle(nextPiece) : "the first verse"
            }
            onStart={() => {
              void handleIntroduce();
            }}
            onDone={finishForToday}
            busy={introduceBusy}
          />
        ) : (
          <div className="flex justify-center py-16">
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-label="Starting the first verse"
            />
          </div>
        )
      ) : null}

      {showNextVersePanel ? (
        <NextVersePanel
          finishedTitle={finishedPiece ? pieceCardTitle(finishedPiece) : null}
          nextTitle={nextPiece ? pieceCardTitle(nextPiece) : "the next verse"}
          onStart={() => {
            void handleIntroduce();
          }}
          onDone={finishForToday}
          busy={introduceBusy}
        />
      ) : null}

      {learning &&
      effectivePhase === "section-complete" &&
      !holdResult &&
      !recitingSection ? (
        <SectionCompletePanel
          onRecite={() => setRecitingSection(true)}
          onSkip={handleSkipSection}
        />
      ) : null}

      {learning &&
      effectivePhase === "connect" &&
      !holdResult &&
      !recitingConnect ? (
        <ConnectPanel
          title={connectPairTitle(
            (state.rehearsalRopeIndexes ?? [])
              .map((index) => state.pieces[index])
              .filter((piece): piece is PassagePiece => piece !== undefined),
          )}
          onRecite={() => setRecitingConnect(true)}
          onSkip={handleSkipSection}
        />
      ) : null}

      {showDoneToday ? (
        <DoneTodayPanel
          description={
            effectivePhase === "budget-exhausted"
              ? BUDGET_EXHAUSTED_COPY
              : FRONTIER_LOCKED_COPY
          }
          finishedTitle={finishedPiece ? pieceCardTitle(finishedPiece) : null}
          canPractice={ropePieceIndexes(state.pieces).length >= 2}
          onPractice={() => {
            setState((current) => ({
              ...current,
              phase: "rope",
              pendingMutation: undefined,
            }));
          }}
          onDone={finishForToday}
        />
      ) : null}

      {showRecall && recall ? (
        <div className="space-y-3">
          {recall.mode === "rope" &&
          effectivePhase === "rope" &&
          !holdResult &&
          !refresher.isOpen ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {showSectionStart ? (
                <Button
                  type="button"
                  variant={ropeOverride === "section" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRopeOverride("section")}
                >
                  From the start of this section
                </Button>
              ) : null}
              {showBeginningStart ? (
                <Button
                  type="button"
                  variant={ropeOverride === "beginning" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRopeOverride("beginning")}
                >
                  From the beginning of the passage
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSkipWarmup}
              >
                {WARMUP_SKIP_LABEL}
              </Button>
            </div>
          ) : null}
          <PassageRecallCard
            key={`${recall.mode}:${recall.title}:${refresher.phase}`}
            mode={recall.mode}
            phaseLabel={
              recall.mode === "frontier"
                ? (PRACTICE_STAGES[recall.learnStage]?.label ?? "Learn")
                : refresher.step
                  ? refresherHeader(refresher.step, refresher.total)
                  : phaseLabel
            }
            title={recall.title}
            subtitle={recall.subtitle}
            promptLine={recall.promptLine}
            versePlainText={recall.versePlainText}
            loading={recall.loading}
            error={recall.error}
            retry={recall.retry}
            hint={recall.hint}
            stallCue={cue?.text}
            stallCueLabel={cue?.label}
            stopBeforeCue={recall.stopBeforeCue}
            learnStage={recall.learnStage}
            stageReps={recall.stageReps}
            status={recall.status}
            showJourneyBar={recall.showJourneyBar}
            intervalDays={view.intervalDays}
            ease={view.ease}
            readContinue={recall.readContinue}
            onRefresher={
              // A Memorized passage waits for its recent reviews (S12's stale
              // prompt); a Learning passage has none to wait for (S15).
              (isMaintenance
                ? (reviewDue || practiceSession) && staleCheck !== undefined
                : learningRefreshable) &&
              !refresher.isOpen &&
              !recall.loading &&
              !recall.error &&
              wordCountsReady &&
              recall.versePlainText !== ""
                ? () => openRefresher(practiceSession ? "practice" : "pre-try")
                : undefined
            }
            stale={stale}
            resultView={resultView}
            onSubmit={handleGraded}
            onContinueAfterResult={continueAfterResult}
            // Keyed by phase, so each refresher step mounts fresh: step 1 when
            // the refresher opens, the rest on Continue.
            revealHeader={refresher.isOpen}
          />
        </div>
      ) : null}

      {finishedReview ? (
        <PassageReviewSummary
          title={packName}
          attempts={finishedReview.attempts}
          dueAt={finishedReview.dueAt}
          onDone={leaveSession}
          refresh={{
            packId,
            references: pieceRefs,
            status: finishedReview.status,
            returnTo: exitHref ?? MEMORY_HOME,
          }}
          restored={restoredSummary !== undefined}
        />
      ) : null}

      {moment === "showing" || (moment === "owed" && wordCountsReady) ? (
        <PassageCompleteMoment
          packId={packId}
          title={packName}
          verseCount={verseCountIn(state.pieces)}
          createdAt={view.createdAt}
          startedOverAt={view.startedOverAt}
          segments={composite.segments}
          onDone={moment === "owed" ? () => setMoment(null) : finishForToday}
        />
      ) : null}
    </PassageSessionShell>
  );
}

function CarriedOverNotice({
  notice,
  onDismiss,
}: {
  notice: string;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <div
      role="note"
      className="mx-auto mb-4 flex max-w-xl items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-3 text-sm text-muted-foreground"
    >
      <Info className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{notice}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

function NextVersePanel({
  finishedTitle,
  nextTitle,
  onStart,
  onDone,
  busy = false,
}: {
  finishedTitle: string | null;
  nextTitle: string;
  onStart: () => void;
  onDone: () => void;
  busy?: boolean;
}): JSX.Element {
  return (
    <CheckpointCard
      title={finishedTitle ?? nextTitle}
      description={
        finishedTitle ? NEXT_VERSE_PROMPT_COPY : START_VERSE_PROMPT_COPY
      }
      success={Boolean(finishedTitle)}
    >
      <Button type="button" onClick={onStart} disabled={busy}>
        {busy ? "Starting…" : `Start ${nextTitle}`}
      </Button>
      <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
        {DONE_FOR_NOW_LABEL}
      </Button>
    </CheckpointCard>
  );
}

function DoneTodayPanel({
  finishedTitle,
  description,
  canPractice,
  onPractice,
  onDone,
}: {
  finishedTitle: string | null;
  description: string;
  canPractice: boolean;
  onPractice: () => void;
  onDone: () => void;
}): JSX.Element {
  return (
    <CheckpointCard
      title={finishedTitle ?? "That's enough for today"}
      description={description}
      success
    >
      {canPractice ? (
        <Button type="button" onClick={onPractice}>
          {PRACTICE_WHAT_YOU_KNOW_LABEL}
        </Button>
      ) : null}
      <Button
        type="button"
        variant={canPractice ? "outline" : "default"}
        onClick={onDone}
      >
        {DONE_FOR_NOW_LABEL}
      </Button>
    </CheckpointCard>
  );
}

function SectionCompletePanel({
  onRecite,
  onSkip,
}: {
  onRecite: () => void;
  onSkip: () => void;
}): JSX.Element {
  return (
    <CheckpointCard
      title="Section complete"
      description={SECTION_COMPLETE_COPY}
    >
      <Button type="button" onClick={onRecite}>
        {SECTION_RECITE_LABEL}
      </Button>
      <Button type="button" variant="outline" onClick={onSkip}>
        Continue
      </Button>
    </CheckpointCard>
  );
}

function ConnectPanel({
  title,
  onRecite,
  onSkip,
}: {
  title: string;
  onRecite: () => void;
  onSkip: () => void;
}): JSX.Element {
  return (
    <CheckpointCard title={title} description={CONNECT_COPY}>
      <Button type="button" onClick={onRecite}>
        {CONNECT_RECITE_LABEL}
      </Button>
      <Button type="button" variant="outline" onClick={onSkip}>
        Skip for now
      </Button>
    </CheckpointCard>
  );
}

function CheckpointCard({
  title,
  description,
  success = false,
  children,
}: {
  title: string;
  description: string;
  success?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Card className="mx-auto w-full max-w-xl overflow-hidden">
        <CardHeader className="gap-3 text-center">
          {success ? (
            <CheckCircle2
              className="mx-auto h-8 w-8 text-primary"
              aria-hidden
            />
          ) : null}
          <CardTitle className="text-3xl tracking-tight">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2 border-t">
          {children}
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Keep the result-view hint/prompt frozen on `base`, but overlay journey
 * fields from the progressed piece so the learning bar advances on check.
 */
function heldRecallWithJourneyProgress(
  base: BuiltRecall,
  next: PassageSessionState,
): BuiltRecall {
  const pending = next.pendingMutation;
  if (!pending || pending.name !== "recordAttempt") return base;
  if (typeof pending.pieceIndex !== "number") return base;
  const progressed = next.pieces[pending.pieceIndex];
  if (!progressed) return base;
  return {
    ...base,
    learnStage: progressed.learnStage,
    stageReps: progressed.stageReps,
    status: pieceStatus(progressed),
  };
}

function nextReviewLine(dueAt: number, now: number): string {
  return `Next review ${formatDueDay(dueAt, now)}`;
}

function needARefresher(
  onClick: () => void,
): NonNullable<PassageRecallResultView["offer"]> {
  return {
    label: NEED_A_REFRESHER_LABEL,
    tooltip: NEED_A_REFRESHER_PASSAGE_TOOLTIP,
    onClick,
  };
}

function tryAnotherRefresher(
  open: (kind: "practice") => void,
): NonNullable<PassageRecallResultView["offer"]> {
  return {
    label: TRY_ANOTHER_REFRESHER_LABEL,
    onClick: () => open("practice"),
  };
}

/** Where the refresher is, and what its First letters steps hint. */
type RefresherHint = {
  phase: VerseRefresherPhase;
  /** Picks step 1's random half, verse by verse. */
  seed: number;
  /** The verses step 1 missed, first-lettered on every word. */
  everyWordVerses: readonly PassageVerseKey[];
};

type ReviewRefresher = RefresherHint & {
  /** Shaky verses and the held miss's weak ones. */
  targets: readonly PassageVerseKey[];
  /** The verses recited: the whole passage, or a Refresh's learned window. */
  segments: readonly CompositePassageSegment[];
};

/**
 * The refresher's hint: step 1 shows a random half of first letters on shaky
 * verses and on verses the held miss scored under 85%, every other word blank
 * in place, verse by verse even inside one piece; with none of those among the
 * verses recited, on every verse. The every-word step shows first letters on
 * every word of the verses step 1 missed. From memory shows none.
 */
function reviewHint(refresher: ReviewRefresher): PassageRecallHint {
  if (refresher.phase === "step2") {
    return { type: "hidden", message: NOW_TRY_WITHOUT_HINTS };
  }
  if (refresher.phase === "off") {
    return { type: "hidden", message: FROM_MEMORY_PASSAGE_HINT };
  }
  if (refresher.phase === "every-word") {
    return everyWordHint(refresher.segments, refresher.everyWordVerses);
  }
  return {
    type: "text",
    text: firstLettersHintText(
      refresher.segments,
      refresher.targets,
      seededRandom(refresher.seed),
    ),
    label: "Hint",
  };
}

function everyWordHint(
  segments: readonly CompositePassageSegment[],
  verses: readonly PassageVerseKey[],
): PassageRecallHint {
  return {
    type: "text",
    text: firstLettersHintText(segments, verses),
    label: "Hint",
  };
}

/**
 * A Learning warm-up or section recital as its refresher: a random half of
 * first letters on every verse of the same range (`segments`), then first
 * letters on every word of the verses that missed, then no hints.
 */
function learningRefresherRecall(
  base: BuiltRecall,
  refresher: RefresherHint & {
    segments: readonly CompositePassageSegment[];
  },
): BuiltRecall {
  const { phase, segments } = refresher;
  return {
    ...base,
    hint:
      phase === "step1"
        ? {
            type: "text",
            text: firstLettersHintText(
              segments,
              passageVersesIn(segments),
              seededRandom(refresher.seed),
            ),
            label: "Hint",
          }
        : phase === "every-word"
          ? everyWordHint(segments, refresher.everyWordVerses)
          : { type: "hidden", message: NOW_TRY_WITHOUT_HINTS },
  };
}

/**
 * A whole-passage recital over `indexes`: the whole passage on a Memorized
 * one, the learned verses on a Learning one's Refresh, which never claims to
 * be the whole passage.
 */
function reviewRecall(
  packName: string,
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
  texts: readonly string[],
  composite: { loading: boolean; error: string | null; retry: () => void },
  refresher: ReviewRefresher,
): BuiltRecall {
  const whole = indexes.length === pieces.length;
  return {
    mode: "review",
    title: whole ? packName : windowTitle(packName, pieces, indexes),
    subtitle: whole
      ? `${verseCountIn(pieces)} verses · whole passage`
      : undefined,
    promptLine: whole
      ? "Recite the whole passage from memory"
      : TYPE_THIS_PART_PROMPT,
    versePlainText: joinPieceTexts(pieces, indexes, texts),
    loading: composite.loading,
    error: composite.error,
    retry: composite.retry,
    hint: reviewHint(refresher),
    pickUpCue: null,
    stopBeforeCue: null,
    learnStage: 3,
    stageReps: 0,
    status: "reviewing",
    showJourneyBar: false,
    readContinue: false,
  };
}

function ropeRecall(
  packName: string,
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
  pieceTexts: readonly string[],
  compositeLoading: boolean,
  compositeError: string | null,
  retry: () => void,
  subtitle: string | undefined,
  promptLine: string,
): BuiltRecall {
  const start = indexes[0] ?? 0;
  const end = (indexes[indexes.length - 1] ?? 0) + 1;
  const hintText = compositeHintForWindow(pieces, start, end, pieceTexts);
  const allHidden = pieces
    .filter((_, index) => indexes.includes(index))
    .every((piece) => piece.attachment === "solid");

  return {
    mode: "rope",
    pieceIndexes: indexes,
    title: windowTitle(packName, pieces, indexes),
    subtitle,
    promptLine,
    versePlainText: joinPieceTexts(pieces, indexes, pieceTexts),
    loading: compositeLoading,
    error: compositeError,
    retry,
    hint: allHidden
      ? { type: "hidden", message: FROM_MEMORY_PASSAGE_HINT }
      : { type: "text", text: hintText, label: "Hint" },
    pickUpCue: pickUpCue(pieces, pieceTexts, start),
    stopBeforeCue: allHidden ? stopBeforeCue(pieceTexts, end - 1) : null,
    learnStage: chromeStage(pieces, indexes),
    stageReps: 0,
    status: "learning",
    showJourneyBar: false,
    readContinue: false,
  };
}

function buildingRecall(args: {
  packName: string;
  state: PassageSessionState;
  recitingSection: boolean;
  recitingConnect: boolean;
  pieceTexts: readonly string[];
  compositeLoading: boolean;
  compositeError: string | null;
  retry: () => void;
  ropeIndexes: readonly number[];
}): BuiltRecall | null {
  const {
    packName,
    state,
    recitingSection,
    recitingConnect,
    pieceTexts,
    compositeLoading,
    compositeError,
    retry,
    ropeIndexes,
  } = args;
  const phase = state.phase;

  if (
    phase === "offer-introduce" ||
    phase === "frontier-locked" ||
    phase === "budget-exhausted"
  ) {
    return null;
  }

  if (phase === "section-complete") {
    if (!recitingSection) return null;
    const indexes = sectionIndexes(state.pieces);
    if (indexes.length === 0) return null;
    return ropeRecall(
      packName,
      state.pieces,
      indexes,
      pieceTexts,
      compositeLoading,
      compositeError,
      retry,
      "This section",
      "Recite this section from memory",
    );
  }

  if (phase === "connect") {
    if (!recitingConnect) return null;
    const indexes =
      state.rehearsalRopeIndexes && state.rehearsalRopeIndexes.length > 0
        ? [...state.rehearsalRopeIndexes]
        : ropeIndexes.slice(-2);
    if (indexes.length === 0) return null;
    return ropeRecall(
      packName,
      state.pieces,
      indexes,
      pieceTexts,
      compositeLoading,
      compositeError,
      retry,
      "Together",
      "Type both verses together",
    );
  }

  if (phase === "stall-repair") {
    const indexes = repairPromptIndexes(state);
    const start = indexes[0] ?? 0;
    const end = (indexes[indexes.length - 1] ?? 0) + 1;
    return {
      mode: "repair",
      title: windowTitle(packName, state.pieces, indexes),
      subtitle: "Try this part again",
      promptLine: TYPE_THIS_PART_PROMPT,
      versePlainText: joinPieceTexts(state.pieces, indexes, pieceTexts),
      loading: compositeLoading,
      error: compositeError,
      retry,
      hint: {
        type: "text",
        text: compositeHintForWindow(state.pieces, start, end, pieceTexts),
        label: "Hint",
      },
      pickUpCue: null,
      stopBeforeCue: null,
      learnStage: chromeStage(state.pieces, indexes),
      stageReps: 0,
      status: "learning",
      showJourneyBar: false,
      readContinue: false,
    };
  }

  if (phase === "frontier") {
    const due = dueFrontierIndex(state.pieces, state.now);
    if (due === null) return null;
    const piece = state.pieces[due];
    if (!piece) return null;
    const text = pieceTexts[due] ?? "";
    const masked = frontierHint(text, piece.learnStage, piece.stageReps);
    return {
      mode: "frontier",
      title: pieceCardTitle(piece),
      subtitle: undefined,
      promptLine:
        masked.stage === "full"
          ? "Read it through, then continue"
          : masked.stage === "hidden"
            ? "Recall the verse from memory"
            : "Type what you remember",
      versePlainText: text,
      loading: compositeLoading,
      error: compositeError,
      retry,
      hint:
        masked.stage === "hidden"
          ? {
              type: "hidden",
              message:
                "No hint text. Type the verse from memory, then check your answer.",
            }
          : { type: "tokens", tokens: masked.tokens },
      pickUpCue:
        masked.stage === "hidden"
          ? pickUpCue(state.pieces, pieceTexts, due, { includeLearning: true })
          : null,
      stopBeforeCue:
        masked.stage === "hidden" ? stopBeforeCue(pieceTexts, due) : null,
      learnStage: piece.learnStage,
      stageReps: piece.stageReps,
      status: pieceStatus(piece),
      showJourneyBar: true,
      readContinue: masked.stage === "full",
    };
  }

  const ropePhases: PassageSessionPhase[] = ["rope", "passage-complete"];
  if (!ropePhases.includes(phase)) return null;
  if (ropeIndexes.length === 0) return null;

  return ropeRecall(
    packName,
    state.pieces,
    ropeIndexes,
    pieceTexts,
    compositeLoading,
    compositeError,
    retry,
    undefined,
    phase === "rope" ? WARMUP_PROMPT_COPY : PRACTICE_ROPE_PROMPT_COPY,
  );
}

function PassageSessionShell({
  phaseLabel,
  packName,
  onExit,
  onHome,
  backLabel,
  exitHref,
  progress,
  persistError,
  aside,
  children,
}: {
  /** Left off on a summary, which names the session but no step. */
  phaseLabel?: string;
  packName: string;
  onExit: () => void;
  onHome?: () => void;
  backLabel: string;
  exitHref?: string;
  progress?: SessionProgress;
  persistError: string | null;
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <SessionBackButton
            onExit={onExit}
            onHome={onHome}
            label={backLabel}
            exitHref={exitHref}
          />
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg tracking-tight">
            {phaseLabel === undefined ? (
              <span className="truncate font-semibold">{packName}</span>
            ) : (
              <>
                <span
                  className="shrink-0 font-semibold"
                  role="status"
                  aria-label={`Session phase: ${phaseLabel}`}
                >
                  {phaseLabel}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <span className="truncate font-medium text-muted-foreground">
                  {packName}
                </span>
              </>
            )}
          </h1>
          {progress ? <SessionHeaderProgress progress={progress} /> : null}
        </div>
      </header>
      {persistError ? (
        <div
          role="alert"
          className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
        >
          {persistError}
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 pt-6 pb-24">
          <SessionColumns aside={aside}>{children}</SessionColumns>
        </div>
      </ScrollArea>
    </div>
  );
}
