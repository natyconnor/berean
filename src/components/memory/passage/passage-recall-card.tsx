import {
  type JSX,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { LearningJourneyBar } from "@/components/memory/practice/learning-journey-bar";
import {
  PRACTICE_STAGES,
  practiceChromeFor,
} from "@/components/memory/practice/practice-stages";
import { PreviewFillExactAnswerButton } from "@/components/memory/preview-fill-exact-answer-button";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
  type VerseAttemptQuality,
} from "@/components/study/study-attempt-quality";
import { VerseAttemptResult } from "@/components/study/study-verse-memory-card";
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
import { cn } from "@/lib/utils";
import { countVerseWords, type HintToken } from "@/lib/verse-hint";

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
  learnStage: number;
  stageReps: number;
  status: MemoryStatus;
  showJourneyBar?: boolean;
  /** Read (full text) banks without typing. Frontier only. */
  readContinue?: boolean;
  onSubmit: (result: PassageRecallResult) => Promise<boolean | void>;
  onContinueAfterResult?: () => void;
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
  learnStage,
  stageReps,
  status,
  showJourneyBar = false,
  readContinue = false,
  onSubmit,
  onContinueAfterResult,
}: PassageRecallCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const { submit, pending: submitPending } = useSubmitLock();

  const stageInfo = PRACTICE_STAGES[learnStage] ?? PRACTICE_STAGES[0];
  const stageColor = practiceChromeFor(learnStage, status);
  const wordCount = countVerseWords(versePlainText);
  const isReadPrime = readContinue;
  const compositeField =
    mode === "rope" || mode === "review" || mode === "repair";

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
  const offerTryAgain = checked && !passed && mode === "frontier";

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
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
    setChecked(false);
    setTypedAnswer("");
    onContinueAfterResult?.();
    window.requestAnimationFrame(() => answerInputRef.current?.focus());
  }

  useEnterToClick(actionRef, !checked ? isReadPrime : true);

  useEffect(() => {
    if (!checked && !isReadPrime) return;
    actionRef.current?.focus();
  }, [checked, isReadPrime]);

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

  const requiredToday = requiredRepsFor(learnStage, wordCount);
  const sessionGoalLabel =
    showJourneyBar && status !== "reviewing" && status !== "mastered"
      ? `${stageInfo.label} · ${Math.min(stageReps, requiredToday)} of ${requiredToday} today`
      : null;

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
            <CardTitle className="mt-2 text-3xl tracking-tight">
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
            />
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5">
          {stallCue ? <StallCue text={stallCue} /> : null}
          {!checked && (
            <>
              <div
                className={cn(
                  "min-h-[220px] rounded-xl border bg-background/75 px-5 py-5 text-left text-lg leading-8",
                  compositeField && "max-h-[45vh] overflow-y-auto",
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
                  <div className="space-y-3">
                    <p className="text-sm text-destructive">
                      Could not load verse text.
                    </p>
                    <Button size="sm" variant="outline" onClick={retry}>
                      Retry
                    </Button>
                  </div>
                ) : hint.type === "hidden" ? (
                  <div className="flex h-full min-h-[140px] items-center justify-center text-center">
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {hint.message}
                    </p>
                  </div>
                ) : hint.type === "tokens" ? (
                  <HintTokenText tokens={hint.tokens} />
                ) : (
                  <p className="whitespace-pre-wrap" aria-label={hint.label}>
                    {hint.text}
                  </p>
                )}
              </div>

              {!isReadPrime && (
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
                    "bg-background/80",
                    compositeField
                      ? "min-h-[300px] max-h-[60vh] resize-y"
                      : "min-h-[170px] resize-none",
                  )}
                  aria-label={fieldLabel}
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
              />
              <p className="text-center text-sm text-muted-foreground">
                {`${checkedAccuracy}% recalled.`}
                {passed ? "" : ` Pass at ${PASSAGE_PASS_ACCURACY}%.`}
              </p>
            </div>
          )}
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
            {checked ? (
              <Button
                ref={actionRef}
                type="button"
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={continueAttempt}
                loading={submitPending}
              >
                {offerTryAgain ? (
                  <RotateCcw className="h-4 w-4" aria-hidden />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                )}
                {offerTryAgain ? "Try again" : "Continue"}
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

function StallCue({ text }: { text: string }): JSX.Element {
  return (
    <div
      className="rounded-xl border bg-background/75 px-4 py-3 text-left text-sm leading-6"
      aria-label="Starting hint"
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Starting hint
      </p>
      <p className="whitespace-pre-wrap font-mono tracking-wide text-muted-foreground">
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
