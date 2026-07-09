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
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { devLog } from "@/lib/dev-log";
import { diffWords } from "@/lib/diff-words";
import { MAX_LEARN_STAGE, requiredRepsFor } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";
import {
  type HintToken,
  hintForProgress,
  maskVerseText,
} from "@/lib/verse-hint";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { PRACTICE_STAGES } from "../memory/practice/practice-stages";
import {
  classifyVerseAttempt,
  type VerseAttemptQuality,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import type { VerseMemoryCard } from "./study-card-model";
import { useRecordVerseAttempt } from "./use-record-verse-attempt";
import { VerseAttemptResult } from "./study-verse-memory-card";

interface StudyVerseLearnProps {
  card: VerseMemoryCard;
}

/** Live learning progress for the verse this card is teaching. */
interface VerseProgress {
  learnStage: number;
  stageReps: number;
}

// Bounded retries for the one-shot rung restore on transient read failures.
const RESTORE_MAX_ATTEMPTS = 3;

function clampStage(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.min(MAX_LEARN_STAGE, Math.max(0, Math.trunc(stage)));
}

function clampReps(reps: number): number {
  if (!Number.isFinite(reps)) return 0;
  return Math.max(0, Math.trunc(reps));
}

/**
 * Local mirror of the scheduler's learning-phase transition, used only as a
 * fallback when a recorded attempt resolves to `null` (verse not hearted or the
 * mutation failed) so the UI still advances instead of stalling. On the normal
 * path we adopt the server-authoritative `learnStage`/`stageReps` instead.
 */
function predictLearning(
  stage: number,
  reps: number,
  quality: VerseAttemptQuality,
): VerseProgress {
  if (quality === "exact") {
    const nextReps = reps + 1;
    if (nextReps >= requiredRepsFor(stage)) {
      if (stage >= MAX_LEARN_STAGE) {
        return { learnStage: MAX_LEARN_STAGE, stageReps: 0 };
      }
      return { learnStage: stage + 1, stageReps: 0 };
    }
    return { learnStage: stage, stageReps: nextReps };
  }
  if (quality === "off") {
    if (reps > 0) {
      return { learnStage: stage, stageReps: reps - 1 };
    }
    if (stage > 0) {
      const prevStage = stage - 1;
      return {
        learnStage: prevStage,
        stageReps: Math.max(0, requiredRepsFor(prevStage) - 1),
      };
    }
    return { learnStage: 0, stageReps: 0 };
  }
  // close: hold the band and its banked reps.
  return { learnStage: stage, stageReps: reps };
}

export function StudyVerseLearn({ card }: StudyVerseLearnProps) {
  // Server-authoritative rung (band + reps banked on it). Held null until the
  // one-shot restore resolves so we never flash the default Read prime.
  const [progress, setProgress] = useState<VerseProgress | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const refLabel = formatVerseRef(card.reference);
  const { data, loading, error } = useEsvReference(card.reference);

  const { record, resolveVerseRefId, heartedVersesReady } =
    useRecordVerseAttempt();
  const getOrCreateForVerse = useMutation(api.verseMemory.getOrCreateForVerse);
  const verseRefId = resolveVerseRefId(card.reference);
  // `learnStage`/`stageReps` on the server are the single source of truth for
  // the rung: the scheduler advances/drops the band and banks reps based on
  // attempt quality. The UI adopts them on open (restore) and only after the
  // learner continues, so the review never changes underneath them.
  const restoredRef = useRef(false);
  const interactedRef = useRef(false);
  // The server-authoritative rung a recorded attempt returned. Held here and
  // adopted only when the learner continues, keeping the checked result stable.
  const pendingProgressRef = useRef<VerseProgress | null>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const reviewActionRef = useRef<HTMLButtonElement>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  // Serializes attempt submission: the synchronous in-flight lock collapses
  // same-tick double activations (double-tap, touch+mouse, Enter + click) into
  // a single recorded attempt, and `submitPending` disables the control while
  // it's in flight. One lock suffices because only one submit path (Read prime,
  // check-answer, or the result-view Continue) is mounted at a time.
  const { submit, pending: submitPending } = useSubmitLock();

  const applyProgress = useCallback((next: VerseProgress) => {
    setProgress({
      learnStage: clampStage(next.learnStage),
      stageReps: clampReps(next.stageReps),
    });
  }, []);

  const stageReady =
    heartedVersesReady &&
    (verseRefId === null ||
      progress !== null ||
      restoreAttempt >= RESTORE_MAX_ATTEMPTS);

  // Resume the learner at their persisted rung on (re)open. Hold the stage UI
  // until restore finishes so we never flash the default Read prime.
  useEffect(() => {
    if (!heartedVersesReady || !verseRefId) return;
    if (progress !== null || restoredRef.current) return;
    if (restoreAttempt >= RESTORE_MAX_ATTEMPTS) return;

    let cancelled = false;
    void getOrCreateForVerse({ verseRefId, now: Date.now() })
      .then((row) => {
        if (cancelled) return;
        restoredRef.current = true;
        if (!interactedRef.current) {
          applyProgress({
            learnStage: row.learnStage,
            stageReps: row.stageReps ?? 0,
          });
        }
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
    progress,
    getOrCreateForVerse,
    restoreAttempt,
    applyProgress,
  ]);

  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";
  const stageIndex = progress?.learnStage ?? 0;
  const repsIndex = progress?.stageReps ?? 0;
  const stageInfo = PRACTICE_STAGES[stageIndex] ?? PRACTICE_STAGES[0];
  const stageColor = stageInfo.color;
  const {
    stage: hintStage,
    density,
    seed,
  } = hintForProgress(stageIndex, repsIndex);
  const tokens = useMemo(
    () => maskVerseText(versePlainText, hintStage, { density, seed }),
    [versePlainText, hintStage, density, seed],
  );

  const isReadPrime = hintStage === "full";
  const requiredReps = stageInfo.requiredReps;
  // Only the multi-rep fading bands (Guided, Challenge) show a rep counter; the
  // single-rep Read prime and From Memory recall don't.
  const repLabel =
    requiredReps > 1
      ? `rep ${Math.min(repsIndex + 1, requiredReps)} of ${requiredReps}`
      : null;
  const promptLine = isReadPrime
    ? "Read it through, then continue"
    : hintStage === "hidden"
      ? "Recall the verse from memory"
      : (repLabel ?? "Type what you remember");

  const canCheckAnswer =
    !loading &&
    !error &&
    typedAnswer.trim().length > 0 &&
    versePlainText !== "";
  const canContinueRead = !loading && !error && versePlainText !== "";
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

  function continueRead() {
    if (!canContinueRead || !stageReady) return;
    interactedRef.current = true;
    // Submitting the shown (full) text banks the single Read rep, advancing the
    // scheduler to the first fading band. The lock collapses same-tick double
    // activations; it releases whatever the outcome, so a null/unchanged result
    // (mutation error, verse not hearted) re-enables Continue rather than
    // stranding it. There is no result view for the Read prime, so the adopted
    // rung lands directly once the recorded rep settles.
    submit(() =>
      record({
        reference: card.reference,
        tokens: diffWords(versePlainText, versePlainText),
        stage: stageIndex,
        mode: "learn",
      }).then((schedule) => {
        applyProgress(
          schedule
            ? { learnStage: schedule.learnStage, stageReps: schedule.stageReps }
            : predictLearning(stageIndex, repsIndex, "exact"),
        );
        setTypedAnswer("");
        setChecked(false);
        focusAnswerInput();
      }),
    );
  }

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
    interactedRef.current = true;
    // Record the graded attempt but keep the review stable: hold the returned
    // rung and adopt it only after the learner continues. The lock keeps a
    // double-tap from recording twice before the result view (driven by
    // `checked`) mounts and replaces this button.
    submit(() => {
      setChecked(true);
      return record({
        reference: card.reference,
        tokens: diffWords(typedAnswer, versePlainText),
        stage: stageIndex,
        mode: "learn",
      }).then((schedule) => {
        pendingProgressRef.current = schedule
          ? { learnStage: schedule.learnStage, stageReps: schedule.stageReps }
          : null;
      });
    });
  }

  function continueAfterReview() {
    applyProgress(
      pendingProgressRef.current ??
        predictLearning(stageIndex, repsIndex, checkedQuality ?? "close"),
    );
    pendingProgressRef.current = null;
    setTypedAnswer("");
    setChecked(false);
    focusAnswerInput();
  }

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    checkAnswer();
  }

  return (
    <Card
      className={cn(
        "mx-auto w-full overflow-hidden",
        stageReady && stageColor.panel,
      )}
    >
      <CardHeader className="gap-3 text-center">
        <div>
          <p
            className={cn(
              "inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]",
              stageReady ? stageColor.text : "text-muted-foreground",
            )}
          >
            {stageReady && (
              <span
                className={cn("h-2 w-2 rounded-full", stageColor.dot)}
                aria-hidden
              />
            )}
            Learn{stageReady ? ` · ${stageInfo.label}` : ""}
          </p>
          <CardTitle className="mt-2 text-3xl tracking-tight">
            {refLabel}
          </CardTitle>
        </div>
        <p
          className={cn(
            "text-sm font-medium",
            stageReady ? stageColor.text : "text-muted-foreground",
          )}
        >
          {stageReady ? promptLine : "\u00a0"}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {!checked && (
          <>
            <div
              className={cn(
                "min-h-[180px] rounded-xl border bg-background px-4 py-4 text-left text-lg leading-8",
                stageReady && stageColor.panel,
              )}
            >
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
              ) : hintStage === "hidden" ? (
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

            {stageReady && !isReadPrime && (
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
              // Hold until the attempt settles: this both keeps the submit lock
              // from swallowing the next check (resetting the question mid-flight
              // would strand it) and ensures the adopted band/reps land before
              // the next rep renders, so it can't re-record stale.
              disabled={submitPending}
            >
              {checkedQuality === "exact" ? (
                <ArrowRight className="h-4 w-4" aria-hidden />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden />
              )}
              {checkedQuality === "exact" ? "Continue" : "Try again"}
            </Button>
          ) : isReadPrime ? (
            <Button
              type="button"
              variant="default"
              className="flex-1 sm:flex-none"
              onClick={continueRead}
              disabled={!stageReady || !canContinueRead || submitPending}
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
