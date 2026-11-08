import {
  type JSX,
  type ReactNode,
  useEffect,
  useEffectEvent,
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
  pieceAccuracies,
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
import { PassageReviewSummary } from "@/components/memory/review-summary";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { PRACTICE_STAGES } from "@/components/memory/practice/practice-stages";
import { useVerseRefresher } from "@/components/memory/practice/use-verse-refresher";
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
import { useEsvCompositePassage } from "@/hooks/use-esv-composite-passage";
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
import { missedPieceIndexes, shakyFirstLettersHint } from "@/lib/passage-shaky";
import { countVerseWords } from "@/lib/verse-hint";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type BuiltRecall = {
  mode: "rope" | "repair" | "frontier" | "review";
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

/** A saved standalone review: its score and next due date. */
type SavedReview = { accuracy: number; dueAt: number };

/** One unhinted whole-passage try to save as the passage's review. */
type ReviewSave = {
  quality: VerseAttemptQuality;
  accuracy: number;
  durationMs: number;
  now: number;
  pieceAccuracies: (number | null)[];
  refresherUsed?: true;
  /** The held first try this From memory try replaces. */
  replaceHeldId?: Id<"heldPassageAttempts">;
};

/** A cold miss held on the server, and the try it came from. */
type HeldMiss = { heldId: Id<"heldPassageAttempts">; save: ReviewSave };

const SAVE_ATTEMPT_ERROR = "Couldn't save that attempt. Please try again.";
const FROM_MEMORY_PASSAGE_HINT =
  "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.";

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
}: PassageSessionProps): JSX.Element {
  const now = useLiveNow();
  const tzOffsetMinutes = tzOffsetMinutesAt(now);
  const timeZone = getViewerTimeZone();
  const introduceNext = useMutation(api.passageMemory.introduceNext);
  const recordAttempt = useMutation(api.passageMemory.recordAttempt);
  const notePracticeRecital = useMutation(
    api.passageMemory.notePracticeRecital,
  );
  const holdAttempt = useMutation(api.passageMemory.holdAttempt);
  const applyHeldAttempt = useMutation(api.passageMemory.applyHeldAttempt);

  const [status, setStatus] = useState(view.status);
  const isMaintenance = status === "reviewing" || status === "mastered";

  const [state, setState] = useState<PassageSessionState>(() =>
    sessionFromView(view, now, tzOffsetMinutes, undefined, timeZone),
  );

  const endStep = () => {
    clearPassageStepInProgress(packId);
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
    null,
  );
  // Memorized review refresher. A cold miss on a due passage is held on the
  // server (as S5 holds a verse): Continue, leaving, the next load or the
  // backstop counts it, and only a finished From memory try replaces it. Its
  // weak verses are hinted right away.
  const refresher = useVerseRefresher();
  const [reviewDueAt, setReviewDueAt] = useState(view.dueAt);
  const [heldMiss, setHeldMissState] = useState<HeldMiss | null>(null);
  const heldIdRef = useRef<Id<"heldPassageAttempts"> | null>(null);
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
  const carriedOver = useCarriedOverNotice(
    view._id,
    state.pieces,
    !isMaintenance,
  );

  const pieceRefs = useMemo(
    () => view.pieces.map(pieceReference),
    [view.pieces],
  );
  const composite = useEsvCompositePassage(pieceRefs, {
    enabled: view.pieces.length > 0,
  });
  const pieceTexts = useMemo(
    () => view.pieces.map((_, index) => composite.segments[index]?.text ?? ""),
    [view.pieces, composite.segments],
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
  const liveRecall = isMaintenance
    ? reviewRecall(packName, state.pieces, pieceTexts, composite, {
        step: refresher.step,
        heldMiss,
      })
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
  const recall = holdResult && heldRecall ? heldRecall : liveRecall;
  const cue = stallCue ?? recall?.pickUpCue ?? null;

  const autoIntroduceStarted = useRef(false);

  useEffect(() => {
    if (state.phase === "passage-complete") {
      clearPassageStepInProgress(packId);
      return;
    }
    markPassageStepInProgress(packId);
    return () => {
      releasePassageStepInProgress(packId);
    };
  }, [packId, state.phase]);

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

  function adoptReview(accuracy: number, dueAt: number) {
    setSavedReview({ accuracy, dueAt });
    setReviewDueAt(dueAt);
  }

  /** Save a counted review try. Resolves its next due date, or null on failure. */
  async function saveReview(save: ReviewSave): Promise<number | null> {
    try {
      const nextView = await recordAttempt({
        packId,
        kind: "review",
        quality: save.quality,
        accuracy: save.accuracy,
        now: save.now,
        tzOffsetMinutes: tzOffsetMinutesAt(save.now),
        timeZone: getViewerTimeZone(),
        durationMs: save.durationMs,
        pieceAccuracies: save.pieceAccuracies,
        refresherUsed: save.refresherUsed,
        replaceHeldId: save.replaceHeldId,
      });
      adoptReview(save.accuracy, nextView.dueAt);
      adoptView(state, nextView, save.now);
      return nextView.dueAt;
    } catch {
      return null;
    }
  }

  function setHeldMiss(next: HeldMiss | null) {
    heldIdRef.current = next?.heldId ?? null;
    setHeldMissState(next);
  }

  function applyHeld(heldId: Id<"heldPassageAttempts">) {
    const now = Date.now();
    return applyHeldAttempt({
      heldId,
      packId,
      now,
      tzOffsetMinutes: tzOffsetMinutesAt(now),
    });
  }

  // Leaving a seen miss counts it: Back, Home, the next queue item, or the
  // tab. If this apply never lands, the next load or the backstop does it.
  const applyHeldOnLeave = useEffectEvent(() => {
    const heldId = heldIdRef.current;
    if (!heldId) return;
    heldIdRef.current = null;
    void applyHeld(heldId).catch(() => undefined);
  });

  useEffect(() => {
    const leave = () => applyHeldOnLeave();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  /** Hold a cold miss on the server. Nothing counts until it is applied. */
  async function holdReviewMiss(
    save: ReviewSave,
    shown: PassageRecallResultView,
  ) {
    retrySaveRef.current = () => holdReviewMiss(save, shown);
    try {
      const { heldId } = await holdAttempt({
        packId,
        quality: save.quality,
        accuracy: save.accuracy,
        pieceAccuracies: save.pieceAccuracies,
        now: save.now,
        tzOffsetMinutes: tzOffsetMinutesAt(save.now),
        timeZone: getViewerTimeZone(),
        durationMs: save.durationMs,
      });
      retrySaveRef.current = null;
      setHeldMiss({ heldId, save });
      setResultView(shown);
    } catch {
      setResultView({ tryAgain: true, saveError: REFRESH_SAVE_ERROR });
    }
  }

  async function saveCountedRefresher(save: ReviewSave) {
    retrySaveRef.current = () => saveCountedRefresher(save);
    const dueAt = await saveReview(save);
    if (dueAt === null) {
      setResultView({ tryAgain: true, saveError: REFRESH_SAVE_ERROR });
      return;
    }
    retrySaveRef.current = null;
    if (save.replaceHeldId) setHeldMiss(null);
    setResultView({
      closingLine: nextReviewLine(dueAt, save.now),
      offer:
        save.accuracy < PASSAGE_PASS_ACCURACY
          ? tryAnotherRefresher(openRefresher)
          : undefined,
    });
  }

  function openRefresher(kind: "pre-try" | "after-miss" | "practice") {
    setResultView(null);
    setHoldResult(false);
    setHeldRecall(null);
    refresher.open(kind);
  }

  /** A Memorized passage's typed try, cold or inside the refresher. */
  async function gradeReview(result: PassageRecallResult): Promise<boolean> {
    const save: ReviewSave = {
      quality: result.quality,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
      now: Date.now(),
      pieceAccuracies: pieceAccuracies(result.tokens, pieceTexts),
    };
    const missed = result.accuracy < PASSAGE_PASS_ACCURACY;

    if (refresher.phase === "step1") {
      setResultView({ firstLetters: true, tryAgain: missed });
      return true;
    }
    if (refresher.kind === "practice") {
      try {
        const nextView = await notePracticeRecital({
          packId,
          pieceAccuracies: save.pieceAccuracies,
          now: save.now,
          tzOffsetMinutes: tzOffsetMinutesAt(save.now),
        });
        setState((current) => ({ ...current, pieces: nextView.pieces }));
      } catch {
        // Clearing shaky verses is a bonus; the practice result stands.
      }
      setResultView({
        practiceOnly: true,
        closingLine: PRACTICE_ONLY_CLOSING,
        offer: tryAnotherRefresher(openRefresher),
      });
      return true;
    }
    if (refresher.phase === "step2") {
      await saveCountedRefresher({
        ...save,
        refresherUsed: true,
        replaceHeldId:
          refresher.kind === "after-miss" ? heldMiss?.heldId : undefined,
      });
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
        offer: {
          label: NEED_A_REFRESHER_LABEL,
          tooltip: NEED_A_REFRESHER_PASSAGE_TOOLTIP,
          onClick: () => openRefresher("after-miss"),
        },
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

  /** Continue (or Try again) on a Memorized passage's result. */
  async function continueReview(): Promise<boolean> {
    const retrySave = retrySaveRef.current;
    if (retrySave) {
      await retrySave();
      return false;
    }
    if (refresher.phase === "step1") {
      const retry = resultView?.tryAgain === true;
      setResultView(null);
      if (!retry) refresher.continueToStep2();
      return true;
    }
    let saved = savedReview;
    const held = refresher.isOpen ? null : heldMiss;
    if (held) {
      try {
        const nextView = await applyHeld(held.heldId);
        setHeldMiss(null);
        if (nextView) {
          adoptReview(held.save.accuracy, nextView.dueAt);
          adoptView(state, nextView, held.save.now);
          saved = { accuracy: held.save.accuracy, dueAt: nextView.dueAt };
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
    refresher.close();
    setResultView(null);
    handleContinueAfterResult(saved);
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
    !isMaintenance &&
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
    !isMaintenance &&
    !holdResult &&
    !needsFirstVerse &&
    effectivePhase === "offer-introduce";
  const showDoneToday =
    !isMaintenance &&
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
      phaseLabel={finishedReview ? undefined : phaseLabel}
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

      {effectivePhase === "section-complete" &&
      !holdResult &&
      !recitingSection ? (
        <SectionCompletePanel
          onRecite={() => setRecitingSection(true)}
          onSkip={handleSkipSection}
        />
      ) : null}

      {effectivePhase === "connect" && !holdResult && !recitingConnect ? (
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
          !holdResult ? (
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
                  ? refresherHeader(refresher.step)
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
              reviewDue &&
              !refresher.isOpen &&
              !recall.loading &&
              !recall.error &&
              wordCountsReady &&
              recall.versePlainText !== ""
                ? () => openRefresher("pre-try")
                : undefined
            }
            resultView={isMaintenance ? resultView : null}
            onSubmit={handleGraded}
            onContinueAfterResult={
              isMaintenance ? continueReview : () => handleContinueAfterResult()
            }
          />
        </div>
      ) : null}

      {finishedReview ? (
        <PassageReviewSummary
          title={packName}
          accuracy={finishedReview.accuracy}
          dueAt={finishedReview.dueAt}
          onDone={leaveSession}
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

function tryAnotherRefresher(
  open: (kind: "practice") => void,
): NonNullable<PassageRecallResultView["offer"]> {
  return {
    label: TRY_ANOTHER_REFRESHER_LABEL,
    onClick: () => open("practice"),
  };
}

/**
 * The refresher's hint: First letters shows first letters on shaky verses and
 * on verses the held miss scored under 85%, every other word blank in place.
 * From memory shows none.
 */
function reviewHint(
  pieces: readonly PassagePiece[],
  texts: readonly string[],
  indexes: readonly number[],
  step: 1 | 2 | null,
  heldMiss: HeldMiss | null,
): PassageRecallHint {
  if (step === 2) return { type: "hidden", message: NOW_TRY_WITHOUT_HINTS };
  if (step === null)
    return { type: "hidden", message: FROM_MEMORY_PASSAGE_HINT };
  const targets = heldMiss
    ? missedPieceIndexes(heldMiss.save.pieceAccuracies)
    : new Set<number>();
  pieces.forEach((piece, index) => {
    if (piece.shaky) targets.add(index);
  });
  return {
    type: "text",
    text: joinPieceTexts(
      pieces,
      indexes,
      shakyFirstLettersHint(texts, targets),
    ),
    label: "Hint",
  };
}

function reviewRecall(
  packName: string,
  pieces: readonly PassagePiece[],
  texts: readonly string[],
  composite: { loading: boolean; error: string | null; retry: () => void },
  refresher: { step: 1 | 2 | null; heldMiss: HeldMiss | null },
): BuiltRecall {
  const indexes = pieces.map((_, index) => index);
  return {
    mode: "review",
    title: packName,
    subtitle: `${verseCountIn(pieces)} verses · whole passage`,
    promptLine: "Recite the whole passage from memory",
    versePlainText: joinPieceTexts(pieces, indexes, texts),
    loading: composite.loading,
    error: composite.error,
    retry: composite.retry,
    hint: reviewHint(
      pieces,
      texts,
      indexes,
      refresher.step,
      refresher.heldMiss,
    ),
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
      promptLine: "Type this part from memory",
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
