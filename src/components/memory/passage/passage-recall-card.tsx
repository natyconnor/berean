import {
  type JSX,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import {
  EmptyHintPrompt,
  EnterToCheckHint,
  FirstLettersPanel,
  NeedARefresherButton,
} from "@/components/memory/memory-refresher-controls";
import {
  scrollBelowSessionHeader,
  scrollClearOfModeDock,
  scrollResultBannerIntoView,
} from "@/components/memory/scroll-result-banner";
import { REVIEW_LAPSE_ACCURACY } from "@/lib/memory-scheduler";
import { motion, useReducedMotion } from "framer-motion";

import { LearningJourneyBar } from "@/components/memory/practice/learning-journey-bar";
import {
  currentStageStep,
  PRACTICE_STAGES,
  practiceChromeFor,
} from "@/components/memory/practice/practice-stages";
import { PreviewFillExactAnswerButton } from "@/components/memory/preview-fill-exact-answer-button";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
  type VerseAttemptQuality,
} from "@/components/study/study-attempt-quality";
import { VerseAttemptResult } from "@/components/study/verse-attempt-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useEnterToClick } from "@/hooks/use-enter-to-click";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { diffWords, type DiffToken } from "@/lib/diff-words";
import { requiredRepsFor, type MemoryStatus } from "@/lib/memory-scheduler";
import {
  refreshStepFromLearnStage,
  refreshStepGate,
  type RefreshStep,
} from "@/lib/memory-way-back";
import { PinnedSessionAction } from "@/components/memory/pinned-session-action";
import { RefresherStepLine } from "@/components/memory/refresher-step-line";
import { ScrollFadeBox } from "@/components/memory/scroll-fade-box";
import {
  REFRESH_THESE_VERSES_LABEL,
  backOnTrackCopy,
  nowTryWithoutHintsCopy,
  refresherGoalLabel,
  refresherPhaseLabel,
} from "@/lib/memory-copy";
import { WARMUP_SKIP_LABEL } from "@/components/memory/passage/passage-session-model";
import { PASSAGE_PASS_ACCURACY } from "@/lib/passage-frontier";
import {
  READER_MEASURE_CLASS,
  READER_REFERENCE_CLASS,
  SESSION_VERSE_TEXT_CLASS,
} from "@/lib/reader-typography";
import { cn } from "@/lib/utils";
import { countVerseWords, type HintToken } from "@/lib/verse-hint";

export type PassageRecallMode = "rope" | "repair" | "frontier" | "review";

export type PassageRecallResult = {
  tokens: DiffToken[];
  accuracy: number;
  quality: VerseAttemptQuality;
  durationMs: number;
  via: "read" | "typed";
  hint?: "first-letters";
  holdSchedule?: boolean;
};

export type PassageRecallHint =
  | { type: "tokens"; tokens: readonly HintToken[] }
  | { type: "text"; text: string; label: string }
  | { type: "hidden"; message: string };

interface PassageRecallCardProps {
  mode: PassageRecallMode;
  phaseLabel: string;
  title: string;
  subtitle?: string;
  promptLine: string;
  versePlainText: string;
  hintPlainText?: string;
  loading: boolean;
  error: string | null;
  retry: () => void;
  hint: PassageRecallHint;
  /** Extra cue shown after a failed rope attempt and during stall-repair. */
  stallCue?: string | null;
  /** Label for the stall cue (bridge vs recovery). */
  stallCueLabel?: string;
  learnStage: number;
  stageReps: number;
  status: MemoryStatus;
  showJourneyBar?: boolean;
  /** Review interval; drives progress toward mastered when reviewing. */
  intervalDays?: number;
  /** Review ease; pairs with interval and banked reps for mastery fill. */
  ease?: number;
  /** Read (full text) banks without typing. Frontier only. */
  readContinue?: boolean;
  onSubmit: (result: PassageRecallResult) => Promise<boolean | void>;
  onContinueAfterResult?: () => void;
  onAfterMissRescueFinished?: () => void;
  refreshSitting?: boolean;
  onSkipWarmup?: () => void;
  skipLabel?: string;
  hideAfterMissOffer?: boolean;
  refreshTheseVerses?: boolean;
  continueLabel?: string;
}

export function PassageRecallCard({
  mode,
  phaseLabel,
  title,
  subtitle,
  promptLine,
  versePlainText,
  hintPlainText,
  loading,
  error,
  retry,
  hint,
  stallCue = null,
  stallCueLabel = "Starting hint",
  learnStage,
  stageReps,
  status,
  showJourneyBar = false,
  intervalDays,
  ease,
  readContinue = false,
  onSubmit,
  onContinueAfterResult,
  onAfterMissRescueFinished,
  refreshSitting = false,
  onSkipWarmup,
  skipLabel = WARMUP_SKIP_LABEL,
  hideAfterMissOffer = false,
  refreshTheseVerses = false,
  continueLabel,
}: PassageRecallCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [heldGoalLabel, setHeldGoalLabel] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [rescue, setRescue] = useState<"off" | "letters" | "memory">("off");
  const [rescueHold, setRescueHold] = useState(false);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const resultBannerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const { submit, pending: submitPending } = useSubmitLock();

  const displayStage =
    rescue === "letters" ? 1 : rescue === "memory" ? 3 : learnStage;
  const stageInfo = PRACTICE_STAGES[displayStage] ?? PRACTICE_STAGES[0];
  const stageColor = practiceChromeFor(displayStage, status);
  const wordCount = countVerseWords(versePlainText);
  const isReadPrime = readContinue;
  const compositeField =
    mode === "rope" || mode === "review" || mode === "repair";
  const requiredToday = requiredRepsFor(learnStage, wordCount);
  const sittingStep: RefreshStep | null = refreshSitting
    ? refreshStepFromLearnStage(learnStage)
    : rescueHold && rescue === "letters"
      ? 1
      : rescueHold && rescue === "memory"
        ? 2
        : null;
  const liveGoalLabel =
    sittingStep !== null
      ? refresherGoalLabel(sittingStep)
      : showJourneyBar && status !== "reviewing" && status !== "mastered"
        ? `${stageInfo.label} · ${currentStageStep(stageReps, requiredToday)} of ${requiredToday} today`
        : null;
  const sessionGoalLabel = heldGoalLabel ?? liveGoalLabel;

  const canCheckAnswer =
    !isReadPrime &&
    !loading &&
    !error &&
    typedAnswer.trim().length > 0 &&
    versePlainText !== "";
  const canContinueRead =
    isReadPrime && !loading && !error && versePlainText !== "";

  const checkedDiffTokens = useMemo(
    () => (checked ? diffWords(typedAnswer, versePlainText) : []),
    [checked, typedAnswer, versePlainText],
  );
  const checkedAccuracy = verseAttemptAccuracy(checkedDiffTokens);
  const checkedQuality = classifyVerseAttempt(checkedDiffTokens);
  const passed = checkedAccuracy >= PASSAGE_PASS_ACCURACY;
  const refreshGate =
    sittingStep && checked && checkedQuality
      ? refreshStepGate(sittingStep, {
          accuracy: checkedAccuracy,
          quality: checkedQuality,
        })
      : null;
  const offerTryAgain = checked && !passed && mode === "frontier";

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
    const goalAtCheck = liveGoalLabel;
    submit(async () => {
      const tokens = diffWords(typedAnswer, versePlainText);
      const quality = classifyVerseAttempt(tokens);
      if (!quality) return;
      const saved = await onSubmit({
        tokens,
        accuracy: verseAttemptAccuracy(tokens),
        quality,
        durationMs: Math.max(0, Date.now() - startedAt),
        via: "typed",
        hint:
          rescue === "letters" || (refreshSitting && learnStage === 1)
            ? "first-letters"
            : undefined,
        holdSchedule: rescueHold || refreshSitting || undefined,
      });
      if (saved === false) return;
      setHeldGoalLabel(goalAtCheck);
      setChecked(true);
    });
  }

  function continueRead() {
    if (!canContinueRead) return;
    submit(async () => {
      const tokens = diffWords(versePlainText, versePlainText);
      await onSubmit({
        tokens,
        accuracy: 100,
        quality: "exact",
        durationMs: Math.max(0, Date.now() - startedAt),
        via: "read",
      });
    });
  }

  function focusAnswerKeepingTitle() {
    const field = answerInputRef.current;
    field?.focus({ preventScroll: true });
    scrollBelowSessionHeader(titleRef.current);
    scrollClearOfModeDock(field);
  }

  function resetTyped() {
    setChecked(false);
    setHeldGoalLabel(null);
    setTypedAnswer("");
    window.requestAnimationFrame(focusAnswerKeepingTitle);
  }

  function finishResult() {
    const heldRescue = rescueHold;
    setRescue("off");
    setRescueHold(false);
    resetTyped();
    if (heldRescue) {
      onAfterMissRescueFinished?.();
      return;
    }
    onContinueAfterResult?.();
  }

  function continueAttempt() {
    if (refreshGate?.type === "retry") {
      resetTyped();
      return;
    }
    if (refreshGate?.type === "advance") {
      if (refreshSitting) {
        resetTyped();
        onContinueAfterResult?.();
        return;
      }
      setRescue("memory");
      resetTyped();
      return;
    }
    if (refreshGate?.type === "weak-final") return;
    if (refreshTheseVerses && rescue === "off" && !passed) {
      setRescue("letters");
      setRescueHold(true);
      resetTyped();
      return;
    }
    if (rescue === "letters" && rescueHold) {
      setRescue("memory");
      resetTyped();
      return;
    }
    finishResult();
  }

  useEnterToClick(actionRef, !checked ? isReadPrime : true);

  useEffect(() => {
    if (!checked && !isReadPrime) return;
    if (checked) {
      scrollResultBannerIntoView(resultBannerRef.current);
    }
    // Saving... is disabled, so wait until the save clears before focusing.
    if (submitPending) return;
    actionRef.current?.focus({ preventScroll: true });
  }, [checked, isReadPrime, submitPending]);

  // After Read advances into a typing band, focus the answer box. Continue is
  // unmounted on that transition, so without this focus is left on body.
  // Wait until the first-letters hint has real text so the field isn't left
  // under the Mode dock after a tall hint lands.
  useLayoutEffect(() => {
    if (checked || isReadPrime || loading) return;
    focusAnswerKeepingTitle();
  }, [
    checked,
    isReadPrime,
    rescue,
    learnStage,
    loading,
    versePlainText,
    hintPlainText,
  ]);

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

  const fieldLabel =
    mode === "frontier" ? "Your recalled verse" : "Your recited passage";
  const afterMissOffer =
    checked &&
    checkedAccuracy < REVIEW_LAPSE_ACCURACY &&
    rescue === "off" &&
    !refreshSitting &&
    !hideAfterMissOffer &&
    (mode === "review" || learnStage >= 3);
  const showAfterMiss = afterMissOffer && !submitPending;
  const resultScrollMax = checked && !passed ? "max-h-[30vh]" : "max-h-[45vh]";
  const sittingPhase = sittingStep ? refresherPhaseLabel(sittingStep) : null;
  const continueText =
    refreshTheseVerses && checked && !passed && rescue === "off"
      ? REFRESH_THESE_VERSES_LABEL
      : (continueLabel ?? "Continue");
  const fromMemorySitting = sittingStep === 2 || rescue === "memory";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <Card className={cn("mx-auto w-full overflow-hidden", stageColor.panel)}>
        <CardHeader className="gap-3 text-center">
          <div ref={titleRef}>
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
              {sittingPhase ?? phaseLabel}
            </p>
            <CardTitle className={cn("mt-2", READER_REFERENCE_CLASS)}>
              {title}
            </CardTitle>
          </div>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          <p className={cn("text-xs font-medium", stageColor.text)}>
            {promptLine}
          </p>
          {sittingStep ? (
            <RefresherStepLine step={sittingStep} />
          ) : sessionGoalLabel ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {sessionGoalLabel}
            </p>
          ) : null}
          {showJourneyBar && sittingStep === null && rescue === "off" ? (
            <LearningJourneyBar
              learnStage={learnStage}
              stageReps={stageReps}
              wordCount={wordCount}
              status={status}
              intervalDays={intervalDays}
              ease={ease}
            />
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5">
          {!checked && stallCue ? (
            <StallCue text={stallCue} label={stallCueLabel} />
          ) : null}
          {!checked && (
            <>
              <ScrollFadeBox
                name="hint"
                className={cn(
                  "mx-auto min-h-[120px] max-h-[45vh] rounded-xl border bg-background/75 px-5 py-5 text-left",
                  SESSION_VERSE_TEXT_CLASS,
                  READER_MEASURE_CLASS,
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
                    <Button size="sm" variant="outline" onClick={retry}>
                      Retry
                    </Button>
                  </div>
                ) : rescue === "letters" ||
                  (refreshSitting && learnStage === 1) ? (
                  <FirstLettersPanel
                    text={hintPlainText ?? versePlainText}
                    className="border-0 bg-transparent p-0"
                  />
                ) : fromMemorySitting || hint.type === "hidden" ? (
                  <EmptyHintPrompt
                    passage={compositeField}
                    message={
                      fromMemorySitting
                        ? nowTryWithoutHintsCopy(compositeField)
                        : undefined
                    }
                    onRefresher={
                      !fromMemorySitting && !refreshSitting && rescue === "off"
                        ? () => {
                            setRescue("letters");
                            setRescueHold(false);
                          }
                        : undefined
                    }
                    disabled={submitPending}
                  />
                ) : hint.type === "tokens" ? (
                  <HintTokenText tokens={hint.tokens} />
                ) : (
                  <p className="whitespace-pre-wrap" aria-label={hint.label}>
                    {hint.text}
                  </p>
                )}
              </ScrollFadeBox>

              {!isReadPrime && (
                <ScrollFadeBox name="answer">
                  <Textarea
                    ref={answerInputRef}
                    value={typedAnswer}
                    onChange={(event) => setTypedAnswer(event.target.value)}
                    onKeyDown={handleAnswerKeyDown}
                    placeholder={
                      compositeField
                        ? "Type the passage from memory"
                        : "Type what you remember"
                    }
                    className={cn(
                      "mx-auto field-sizing-content max-h-[45vh] min-h-[180px] resize-none overflow-y-auto bg-background/80 px-4 py-3",
                      SESSION_VERSE_TEXT_CLASS,
                      READER_MEASURE_CLASS,
                    )}
                    aria-label={fieldLabel}
                  />
                </ScrollFadeBox>
              )}
            </>
          )}

          {checked && (
            <div className="space-y-4">
              <VerseAttemptResult
                typedAnswer={typedAnswer}
                versePlainText={versePlainText}
                diffTokens={checkedDiffTokens}
                note={passed ? undefined : `Pass at ${PASSAGE_PASS_ACCURACY}%`}
                bannerRef={resultBannerRef}
                scheduleHeld={refreshSitting || rescueHold}
                praiseLine={
                  refreshGate?.type === "passed-final"
                    ? backOnTrackCopy()
                    : undefined
                }
                scrollMaxClass={resultScrollMax}
                refresherOffer={
                  showAfterMiss ? (
                    <NeedARefresherButton
                      onClick={() => {
                        setRescue("letters");
                        setRescueHold(true);
                        setChecked(false);
                        setTypedAnswer("");
                      }}
                      disabled={submitPending}
                    />
                  ) : undefined
                }
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end border-t">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!checked && !isReadPrime ? (
              <EnterToCheckHint className="sm:mr-auto" />
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              {!checked && !isReadPrime ? (
                <PreviewFillExactAnswerButton
                  versePlainText={versePlainText}
                  onFill={setTypedAnswer}
                  disabled={loading || Boolean(error)}
                />
              ) : null}
              {checked && onSkipWarmup && !passed ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 sm:flex-none"
                  onClick={onSkipWarmup}
                >
                  {skipLabel}
                </Button>
              ) : null}
              <PinnedSessionAction>
                {checked && refreshGate?.type === "weak-final" ? (
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    <Button
                      ref={actionRef}
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={resetTyped}
                      disabled={submitPending}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Try again
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        if (refreshSitting) {
                          onContinueAfterResult?.();
                          return;
                        }
                        finishResult();
                      }}
                      loading={submitPending}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
                      {continueText}
                    </Button>
                  </div>
                ) : checked ? (
                  <Button
                    ref={actionRef}
                    type="button"
                    variant="default"
                    className="flex-1 sm:flex-none"
                    onClick={continueAttempt}
                    loading={submitPending}
                  >
                    {submitPending ? (
                      "Saving..."
                    ) : refreshGate?.type === "retry" || offerTryAgain ? (
                      <>
                        <RotateCcw className="h-4 w-4" aria-hidden />
                        Try again
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" aria-hidden />
                        {continueText}
                      </>
                    )}
                  </Button>
                ) : isReadPrime ? (
                  <Button
                    ref={actionRef}
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
                  <Button
                    type="button"
                    variant="default"
                    className="h-11 flex-1 sm:flex-none"
                    onClick={checkAnswer}
                    disabled={!canCheckAnswer}
                    loading={submitPending}
                  >
                    {submitPending ? (
                      "Saving..."
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Check answer
                      </>
                    )}
                  </Button>
                )}
              </PinnedSessionAction>
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function StallCue({
  text,
  label,
}: {
  text: string;
  label: string;
}): JSX.Element {
  const bridgeOnly = label === "Pick up after";
  return (
    <div
      className="rounded-xl border bg-background/75 px-4 py-3 text-left text-sm leading-6"
      aria-label={label}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          bridgeOnly
            ? "whitespace-pre-wrap text-foreground"
            : "whitespace-pre-wrap font-mono tracking-wide text-muted-foreground"
        }
      >
        {text}
      </p>
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
