import { CheckCircle2, RotateCcw } from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";

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
import { diffWords } from "@/lib/diff-words";
import { cn } from "@/lib/utils";
import {
  type HintStage,
  type HintToken,
  maskVerseText,
} from "@/lib/verse-hint";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { verseAttemptAccuracy } from "./study-attempt-quality";
import type { VerseMemoryCard } from "./study-card-model";
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
const PASS_THRESHOLD = 85;

export function StudyVerseLearn({ card }: StudyVerseLearnProps) {
  const [stage, setStage] = useState<HintStage>("full");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const refLabel = formatVerseRef(card.reference);
  const { data, loading, error } = useEsvReference(card.reference);
  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";
  const tokens = useMemo(
    () => maskVerseText(versePlainText, stage),
    [stage, versePlainText],
  );
  const stageIndex = STAGES.findIndex((item) => item.stage === stage);
  const currentStage = STAGES[stageIndex] ?? STAGES[0];
  const canAdvance = stageIndex >= 0 && stageIndex < STAGES.length - 1;
  const canCheckAnswer = !loading && !error;
  const checkedDiffTokens = useMemo(
    () => (checked ? diffWords(typedAnswer, versePlainText) : []),
    [checked, typedAnswer, versePlainText],
  );
  const checkedAccuracy = verseAttemptAccuracy(checkedDiffTokens);
  const passed = checked && checkedAccuracy >= PASS_THRESHOLD;

  function selectStage(nextStage: HintStage) {
    setStage(nextStage);
    setTypedAnswer("");
    setChecked(false);
  }

  function advanceStage() {
    if (!canAdvance) return;
    selectStage(STAGES[stageIndex + 1].stage);
  }

  function resetAttempt() {
    setTypedAnswer("");
    setChecked(false);
  }

  function checkAnswer() {
    if (!canCheckAnswer) return;
    setChecked(true);
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
        <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {STAGES.map((item, index) => (
            <button
              key={item.stage}
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                item.stage === stage
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => selectStage(item.stage)}
              aria-current={item.stage === stage ? "step" : undefined}
            >
              <span className="sr-only">Stage {index + 1}: </span>
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {currentStage.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="min-h-[180px] rounded-xl border bg-background px-4 py-4 text-left text-lg leading-8">
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
          value={typedAnswer}
          onChange={(event) => {
            setTypedAnswer(event.target.value);
            setChecked(false);
          }}
          onKeyDown={handleAnswerKeyDown}
          placeholder="Type what you remember"
          className="min-h-[150px] resize-none"
          aria-label="Your recalled verse"
        />

        {checked && (
          <div className="space-y-4">
            <VerseAttemptResult
              typedAnswer={typedAnswer}
              versePlainText={versePlainText}
              diffTokens={checkedDiffTokens}
            />
            <p className="text-center text-sm text-muted-foreground">
              {passed
                ? canAdvance
                  ? `${checkedAccuracy}% recalled. Ready for a harder level.`
                  : `${checkedAccuracy}% recalled. Memorized!`
                : `${checkedAccuracy}% recalled. Reach ${PASS_THRESHOLD}% to level up.`}
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
              onClick={resetAttempt}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Try again
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
          {passed && canAdvance && (
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              onClick={advanceStage}
              disabled={loading || !!error}
            >
              Next Level
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
