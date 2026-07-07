import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { devLog } from "@/lib/dev-log";
import { diffWords } from "@/lib/diff-words";
import { cn } from "@/lib/utils";
import {
  type HintStage,
  type HintToken,
  maskVerseText,
} from "@/lib/verse-hint";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import type { VerseMemoryCard } from "./study-card-model";
import { useRecordVerseAttempt } from "./use-record-verse-attempt";
import { VerseAttemptResult } from "./study-verse-memory-card";

interface StudyVerseLearnProps {
  card: VerseMemoryCard;
}

interface StageInfo {
  stage: HintStage;
  label: string;
  description: string;
}

const STAGES: readonly StageInfo[] = [
  {
    stage: "full",
    label: "Full",
    description: "Read and absorb the verse.",
  },
  {
    stage: "first-letters",
    label: "Letters",
    description: "Use first-letter scaffolding.",
  },
  {
    stage: "cloze",
    label: "Blanks",
    description: "Recall the missing words.",
  },
  {
    stage: "hidden",
    label: "Hidden",
    description: "Type it from memory.",
  },
] as const;

// Bounded retries for the one-shot rung restore on transient read failures.
const RESTORE_MAX_ATTEMPTS = 3;

export function StudyVerseLearn({ card }: StudyVerseLearnProps) {
  const [learnStage, setLearnStage] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const refLabel = formatVerseRef(card.reference);
  const { data, loading, error } = useEsvReference(card.reference);

  const { record, resolveVerseRefId, heartedVersesReady } =
    useRecordVerseAttempt();
  const getOrCreateForVerse = useMutation(api.verseMemory.getOrCreateForVerse);
  const verseRefId = resolveVerseRefId(card.reference);
  // `learnStage` on the server is the single source of truth for the ladder
  // rung: the scheduler advances/drops it based on attempt quality. The UI
  // adopts it on open (restore) and when the learner leaves review, so the
  // review state never changes underneath them.
  const restoredRef = useRef(false);
  const interactedRef = useRef(false);
  // Invalidation token so a slow in-flight schedule can't affect a newer
  // attempt after the learner has already continued.
  const attemptSeqRef = useRef(0);
  const pendingLearnStageRef = useRef<number | null>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const reviewActionRef = useRef<HTMLButtonElement>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const applyLearnStage = useCallback((nextLearnStage: number) => {
    setLearnStage(
      Math.min(Math.max(Math.trunc(nextLearnStage), 0), STAGES.length - 1),
    );
  }, []);

  const stageReady =
    heartedVersesReady &&
    (verseRefId === null ||
      learnStage !== null ||
      restoreAttempt >= RESTORE_MAX_ATTEMPTS);

  // Resume the learner at their persisted rung on (re)open. Hold the stage UI
  // until restore finishes so we never flash the default "Full" rung.
  useEffect(() => {
    if (!heartedVersesReady || !verseRefId) return;
    if (learnStage !== null || restoredRef.current) return;
    if (restoreAttempt >= RESTORE_MAX_ATTEMPTS) return;

    let cancelled = false;
    void getOrCreateForVerse({ verseRefId, now: Date.now() })
      .then((row) => {
        if (cancelled) return;
        restoredRef.current = true;
        if (!interactedRef.current) applyLearnStage(row.learnStage);
      })
      .catch((restoreError: unknown) => {
        devLog.warn("verseMemory", "learnStage restore failed", restoreError);
        if (!cancelled) setRestoreAttempt((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [
    verseRefId,
    heartedVersesReady,
    learnStage,
    getOrCreateForVerse,
    restoreAttempt,
    applyLearnStage,
  ]);
  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";
  const stageIndex = learnStage ?? 0;
  const stage = STAGES[stageIndex]?.stage ?? STAGES[0].stage;
  const tokens = useMemo(
    () => maskVerseText(versePlainText, stage),
    [stage, versePlainText],
  );
  const currentStage = STAGES[stageIndex] ?? STAGES[0];
  const canCheckAnswer =
    !loading &&
    !error &&
    typedAnswer.trim().length > 0 &&
    versePlainText !== "";
  const checkedDiffTokens = useMemo(
    () => (checked ? diffWords(typedAnswer, versePlainText) : []),
    [checked, typedAnswer, versePlainText],
  );
  const checkedAccuracy = verseAttemptAccuracy(checkedDiffTokens);
  const checkedQuality = classifyVerseAttempt(checkedDiffTokens);

  useEffect(() => {
    if (!checked) return;
    reviewActionRef.current?.focus();
  }, [checked]);

  function focusAnswerInput() {
    window.requestAnimationFrame(() => {
      answerInputRef.current?.focus();
    });
  }

  function predictedLearnStage() {
    if (checkedQuality === "exact") {
      return Math.min(stageIndex + 1, STAGES.length - 1);
    }
    if (checkedQuality === "off") return Math.max(stageIndex - 1, 0);
    return stageIndex;
  }

  function continueAfterReview() {
    attemptSeqRef.current += 1;
    applyLearnStage(pendingLearnStageRef.current ?? predictedLearnStage());
    pendingLearnStageRef.current = null;
    setTypedAnswer("");
    setChecked(false);
    focusAnswerInput();
  }

  function checkAnswer() {
    if (!canCheckAnswer) return;
    pendingLearnStageRef.current = null;
    setChecked(true);

    // Only a non-empty, gradable answer counts as an interaction / attempt.
    if (typedAnswer.trim().length === 0 || versePlainText.length === 0) return;
    interactedRef.current = true;

    const seq = (attemptSeqRef.current += 1);
    void record({
      reference: card.reference,
      tokens: diffWords(typedAnswer, versePlainText),
      stage: stageIndex,
      mode: "learn",
    }).then((schedule) => {
      // Keep the review stable; adopt the authoritative rung only after the
      // learner continues to the next input phase.
      if (!schedule || attemptSeqRef.current !== seq) return;
      pendingLearnStageRef.current = schedule.learnStage;
    });
  }

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

  return (
    <Card className="mx-auto w-full overflow-hidden">
      <CardHeader className="gap-3 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Learn
          </p>
          <CardTitle className="mt-2 text-3xl tracking-tight">
            {refLabel}
          </CardTitle>
        </div>
        {!stageReady ? (
          <div
            className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 rounded-lg bg-muted p-1"
            aria-hidden
          >
            {STAGES.map((item) => (
              <div
                key={item.stage}
                className="h-8 animate-pulse rounded-md bg-background/60"
              />
            ))}
          </div>
        ) : (
          <ol className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {STAGES.map((item, index) => (
              <li
                key={item.stage}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  item.stage === stage
                    ? "bg-background text-foreground shadow-sm"
                    : index < stageIndex
                      ? "text-foreground/80"
                      : "text-muted-foreground",
                )}
                aria-current={item.stage === stage ? "step" : undefined}
              >
                <span className="sr-only">Stage {index + 1}: </span>
                {item.label}
              </li>
            ))}
          </ol>
        )}
        <p className="text-sm text-muted-foreground">
          {stageReady ? currentStage.description : "\u00a0"}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {!checked && (
          <>
            <div className="min-h-[180px] rounded-xl border bg-background px-4 py-4 text-left text-lg leading-8">
              {!stageReady || loading ? (
                <div className="space-y-3 py-2">
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
                </div>
              ) : error ? (
                <p className="text-sm text-destructive">
                  Could not load verse text.
                </p>
              ) : stage === "hidden" ? (
                <div className="flex h-full min-h-[140px] items-center justify-center text-center">
                  <p className="max-w-sm text-sm text-muted-foreground">
                    No hint text. Type the verse from memory, then check your
                    answer.
                  </p>
                </div>
              ) : (
                <HintTokenText tokens={tokens} />
              )}
            </div>

            <Textarea
              ref={answerInputRef}
              value={typedAnswer}
              onChange={(event) => {
                interactedRef.current = true;
                setTypedAnswer(event.target.value);
                setChecked(false);
              }}
              onKeyDown={handleAnswerKeyDown}
              placeholder="Type what you remember"
              className="min-h-[150px] resize-none"
              aria-label="Your recalled verse"
              disabled={!stageReady}
            />
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
            </p>
            <div className="rounded-xl border bg-card/60 px-4 py-3 text-left text-sm leading-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Full text
              </p>
              {data?.verses.map((verse) => (
                <p key={verse.number}>
                  <span className="mr-1 text-xs font-semibold text-muted-foreground align-top">
                    {verse.number}
                  </span>
                  {verse.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-between">
        <div className="flex w-full gap-2 sm:w-auto">
          {checked ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={continueAfterReview}
              ref={reviewActionRef}
            >
              {checkedQuality === "exact" ? (
                <ArrowRight className="h-4 w-4" aria-hidden />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden />
              )}
              {checkedQuality === "exact" ? "Continue" : "Try again"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              className="flex-1 sm:flex-none"
              onClick={checkAnswer}
              disabled={!stageReady || !canCheckAnswer}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Check answer
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
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
