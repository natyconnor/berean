import {
  type JSX,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import {
  EmptyHintPrompt,
  NeedARefresherLink,
  RefresherOfferButton,
} from "@/components/memory/memory-refresher-controls";
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
import { PASSAGE_PASS_ACCURACY } from "@/lib/passage-frontier";
import {
  READER_MEASURE_CLASS,
  READER_REFERENCE_CLASS,
  SESSION_VERSE_TEXT_CLASS,
} from "@/lib/reader-typography";
import { cn } from "@/lib/utils";
import { countVerseWords, type HintToken } from "@/lib/verse-hint";

import { STOP_BEFORE_LABEL } from "./passage-session-model";

export type PassageRecallMode = "rope" | "repair" | "frontier" | "review";

export type PassageRecallResult = {
  tokens: DiffToken[];
  accuracy: number;
  quality: VerseAttemptQuality;
  durationMs: number;
  via: "read" | "typed";
};

export type PassageRecallHint =
  | { type: "tokens"; tokens: readonly HintToken[] }
  | { type: "text"; text: string; label: string }
  | { type: "hidden"; message: string };

/** What the result shows beyond the score and diff. Review refreshers only. */
export type PassageRecallResultView = {
  /** The main action reads Try again (a First letters miss, or a failed save). */
  tryAgain?: boolean;
  /** An outlined refresher button beside the main action. */
  offer?: { label: string; tooltip?: string; onClick: () => void };
  /** Focus the offer instead of the main action. */
  focusOffer?: boolean;
  closingLine?: string | null;
  /** "Counted as today's review" after a counted ••• Refresh. */
  countedLine?: string | null;
  saveError?: string | null;
  practiceOnly?: boolean;
  /** A First letters try: no celebration, and a miss promises nothing. */
  firstLetters?: boolean;
};

interface PassageRecallCardProps {
  mode: PassageRecallMode;
  phaseLabel: string;
  title: string;
  subtitle?: string;
  promptLine: string;
  versePlainText: string;
  loading: boolean;
  error: string | null;
  retry: () => void;
  hint: PassageRecallHint;
  /** Extra cue shown after a failed rope attempt and during stall-repair. */
  stallCue?: string | null;
  /** Label for the stall cue (bridge vs recovery). */
  stallCueLabel?: string;
  /** Start of the next verse, shown under the answer when typed from memory. */
  stopBeforeCue?: string | null;
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
  /** Quiet "Need a refresher?" link in the hint panel, beneath any hint. */
  onRefresher?: () => void;
  /** Stale: "Refresh it first" in place of the link, settled at the first keystroke. */
  stale?: boolean;
  resultView?: PassageRecallResultView | null;
  onSubmit: (result: PassageRecallResult) => Promise<boolean | void>;
  /** Resolve `false` to stay on the result, e.g. a save to retry. */
  onContinueAfterResult?: () => void | Promise<boolean>;
}

export function PassageRecallCard({
  mode,
  phaseLabel,
  title,
  subtitle,
  promptLine,
  versePlainText,
  loading,
  error,
  retry,
  hint,
  stallCue = null,
  stallCueLabel = "Starting hint",
  stopBeforeCue = null,
  learnStage,
  stageReps,
  status,
  showJourneyBar = false,
  intervalDays,
  ease,
  readContinue = false,
  onRefresher,
  stale = false,
  resultView = null,
  onSubmit,
  onContinueAfterResult,
}: PassageRecallCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  // Snapshot of "First letters · N of M today" at Check so the step label stays
  // on the step just finished while the journey bar adopts banked progress early.
  const [heldGoalLabel, setHeldGoalLabel] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const offerRef = useRef<HTMLButtonElement>(null);
  const { submit, pending: submitPending } = useSubmitLock();
  const idPrefix = useId();
  const headerId = `${idPrefix}-header`;
  const hintMessageId = `${idPrefix}-hint`;
  const bannerId = `${idPrefix}-banner`;
  const errorId = `${idPrefix}-error`;
  const focusOffer = Boolean(resultView?.focusOffer && resultView.offer);
  // Like a verse card: the stale cue never appears once typing has started.
  const [staleCue, setStaleCue] = useState<"pending" | "shown" | "off">(
    "pending",
  );
  const showStaleCue =
    staleCue === "shown" || (staleCue === "pending" && stale);

  const stageInfo = PRACTICE_STAGES[learnStage] ?? PRACTICE_STAGES[0];
  const stageColor = practiceChromeFor(learnStage, status);
  const wordCount = countVerseWords(versePlainText);
  const isReadPrime = readContinue;
  const compositeField =
    mode === "rope" || mode === "review" || mode === "repair";
  const requiredToday = requiredRepsFor(learnStage, wordCount);
  const liveGoalLabel =
    showJourneyBar && status !== "reviewing" && status !== "mastered"
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
  const passed = checkedAccuracy >= PASSAGE_PASS_ACCURACY;
  const offerTryAgain =
    (checked && !passed && mode === "frontier") ||
    Boolean(resultView?.tryAgain);

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
    // Capture before `onSubmit` so a parent that adopts journey progress early
    // cannot advance the step label while the result is still on screen.
    // The check button stays mounted until the save resolves, so its label
    // switches to Saving... for that wait instead of sitting on Check answer.
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

  function continueAttempt() {
    submit(async () => {
      if ((await onContinueAfterResult?.()) === false) return;
      setChecked(false);
      setHeldGoalLabel(null);
      setTypedAnswer("");
      setStaleCue("off");
      window.requestAnimationFrame(() => answerInputRef.current?.focus());
    });
  }

  const saveError = resultView?.saveError ?? null;
  const defaultActionRef = focusOffer && !saveError ? offerRef : actionRef;
  useEnterToClick(defaultActionRef, !checked ? isReadPrime : true);

  useEffect(() => {
    if (!checked && !isReadPrime) return;
    if (submitPending) return;
    defaultActionRef.current?.focus();
  }, [checked, isReadPrime, defaultActionRef, submitPending]);

  // After Read advances into a typing band, focus the answer box. Continue is
  // unmounted on that transition, so without this focus is left on body.
  useEffect(() => {
    if (checked || isReadPrime) return;
    answerInputRef.current?.focus();
  }, [checked, isReadPrime]);

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

  const fieldLabel =
    mode === "frontier" ? "Your recalled verse" : "Your recited passage";

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
              id={headerId}
              className={cn(
                "inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]",
                stageColor.text,
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full", stageColor.dot)}
                aria-hidden
              />
              {phaseLabel}
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
          {sessionGoalLabel ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {sessionGoalLabel}
            </p>
          ) : null}
          {showJourneyBar ? (
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
          {stallCue ? <StallCue text={stallCue} label={stallCueLabel} /> : null}
          {!checked && (
            <>
              <div
                className={cn(
                  "mx-auto min-h-[140px] rounded-xl border bg-background/75 px-5 py-5 text-left",
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
                ) : hint.type === "hidden" ? (
                  <EmptyHintPrompt
                    message={hint.message}
                    messageId={hintMessageId}
                    onRefresher={onRefresher}
                    refreshFirst={showStaleCue}
                    disabled={submitPending}
                  />
                ) : (
                  <>
                    {hint.type === "tokens" ? (
                      <HintTokenText tokens={hint.tokens} />
                    ) : (
                      <p
                        className="whitespace-pre-wrap"
                        aria-label={hint.label}
                      >
                        {hint.text}
                      </p>
                    )}
                    {onRefresher ? (
                      <div className="mt-4 flex justify-center font-sans">
                        <NeedARefresherLink
                          onClick={onRefresher}
                          disabled={submitPending}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {!isReadPrime && (
                <Textarea
                  ref={answerInputRef}
                  value={typedAnswer}
                  onChange={(event) => {
                    if (staleCue === "pending") {
                      setStaleCue(stale ? "shown" : "off");
                    }
                    setTypedAnswer(event.target.value);
                  }}
                  onKeyDown={handleAnswerKeyDown}
                  placeholder={
                    compositeField
                      ? "Type the passage from memory"
                      : "Type what you remember"
                  }
                  className={cn(
                    "mx-auto bg-background/80 px-4 py-3",
                    SESSION_VERSE_TEXT_CLASS,
                    READER_MEASURE_CLASS,
                    compositeField
                      ? "min-h-[180px] resize-y"
                      : "min-h-[170px] resize-none",
                  )}
                  aria-label={fieldLabel}
                  aria-describedby={
                    hint.type === "hidden"
                      ? `${headerId} ${hintMessageId}`
                      : headerId
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
                note={passed ? undefined : `Pass at ${PASSAGE_PASS_ACCURACY}%`}
                bannerId={bannerId}
                errorId={errorId}
                saveError={saveError}
                closingLine={resultView?.closingLine}
                countedLine={resultView?.countedLine}
                practiceOnly={resultView?.practiceOnly}
                unscheduled={resultView?.practiceOnly}
                scheduleHeld={resultView?.firstLetters}
                skipCelebrate={resultView?.firstLetters}
              />
            </div>
          )}
          {stopBeforeCue ? (
            <StallCue text={stopBeforeCue} label={STOP_BEFORE_LABEL} />
          ) : null}
        </CardContent>

        <CardFooter className="flex justify-end border-t">
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {!checked && !isReadPrime ? (
              <PreviewFillExactAnswerButton
                versePlainText={versePlainText}
                onFill={setTypedAnswer}
                disabled={loading || Boolean(error)}
              />
            ) : null}
            {checked && resultView?.offer ? (
              <RefresherOfferButton
                label={resultView.offer.label}
                onClick={resultView.offer.onClick}
                disabled={submitPending}
                buttonRef={offerRef}
                describedBy={bannerId}
                tooltip={resultView.offer.tooltip}
              />
            ) : null}
            {checked ? (
              <Button
                ref={actionRef}
                type="button"
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={continueAttempt}
                loading={submitPending}
                aria-describedby={
                  saveError ? `${bannerId} ${errorId}` : bannerId
                }
              >
                {submitPending ? (
                  "Saving..."
                ) : offerTryAgain ? (
                  <>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Try again
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                    Continue
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
                className="flex-1 sm:flex-none"
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
  const bridgeOnly = label === "Pick up after" || label === STOP_BEFORE_LABEL;
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
