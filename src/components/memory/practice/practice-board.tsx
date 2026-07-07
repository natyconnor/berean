import {
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

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
import { useEsvReference } from "@/hooks/use-esv-reference";
import { diffWords } from "@/lib/diff-words";
import { MAX_LEARN_STAGE } from "@/lib/memory-scheduler";
import {
  buildPracticeOrder,
  nextIndex,
  type PracticeOrder,
  prevIndex,
} from "@/lib/practice-order";
import { cn } from "@/lib/utils";
import { type HintToken, maskVerseText } from "@/lib/verse-hint";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { verseRefKey } from "../../../../shared/verse-ref-key";
import { verseAttemptAccuracy } from "../../study/study-attempt-quality";
import type { CardReference } from "../../study/study-card-model";
import { useRecordVerseAttempt } from "../../study/use-record-verse-attempt";
import { VerseAttemptResult } from "../../study/study-verse-memory-card";
import { PRACTICE_STAGES } from "./practice-stages";
import { PracticeVerseRail } from "./practice-verse-rail";

export interface PracticeVerse {
  reference: CardReference;
}

interface PracticeBoardProps {
  /** The verse set to practice (e.g. the user's hearted verses or a pack). */
  verses: ReadonlyArray<PracticeVerse>;
  /** Return to the memory home. */
  onExit: () => void;
}

interface OrderedVerse {
  id: string;
  reference: CardReference;
}

/**
 * The Practice board: a focused, self-directed surface. One verse card at a
 * time, a verse rail to jump around, a Shuffle / In-order toggle, prev/next
 * navigation, and a manual stage selector (Full · Letters · Blanks · Hidden).
 *
 * Only Hidden-stage recall is scored: an attempt at the hardest rung
 * (`stageIndex === MAX_LEARN_STAGE`) records with `mode: "practice"` and
 * reschedules the verse. The easier stages (Full · Letters · Blanks) are pure,
 * unscored practice — the learner still gets diff/accuracy feedback, but
 * nothing is logged or scheduled.
 */
export function PracticeBoard({
  verses,
  onExit,
}: PracticeBoardProps): JSX.Element {
  const [order, setOrder] = useState<PracticeOrder>("in-order");
  // Bumped each time the user (re-)selects Shuffle so repeated presses reshuffle
  // deterministically without depending on Math.random().
  const [seed, setSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const { record } = useRecordVerseAttempt();

  // Snapshot the practice set once when the board mounts. Like ReviewPlayer
  // freezing its due queue, this keeps mid-session heart changes (which mutate
  // the live `verses` prop) from swapping the verse at the current index —
  // especially dangerous under Shuffle, where the order would silently shift.
  const [baseVerses] = useState<OrderedVerse[]>(() =>
    verses.map((verse) => ({
      id: verseRefKey(verse.reference),
      reference: verse.reference,
    })),
  );

  const orderedVerses = useMemo(
    () => buildPracticeOrder(baseVerses, order, seed),
    [baseVerses, order, seed],
  );

  // Only the hardest rung (Hidden) is scored: an attempt there records and
  // reschedules; easier stages are pure practice.
  const recordsToSchedule = stageIndex === MAX_LEARN_STAGE;

  const boundedIndex =
    orderedVerses.length === 0
      ? 0
      : Math.min(currentIndex, orderedVerses.length - 1);
  const currentVerse = orderedVerses[boundedIndex] ?? null;

  function handleOrderChange(nextOrder: PracticeOrder) {
    setOrder(nextOrder);
    if (nextOrder === "shuffle") setSeed((value) => value + 1);
    setCurrentIndex(0);
  }

  function handleSelectVerse(id: string) {
    const index = orderedVerses.findIndex((verse) => verse.id === id);
    if (index >= 0) setCurrentIndex(index);
  }

  function goToIndex(index: number) {
    setCurrentIndex(index);
  }

  if (orderedVerses.length === 0 || !currentVerse) {
    return (
      <PracticeShell onExit={onExit}>
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No verses to practice yet. Heart a verse in the reader to build your
            practice set.
          </p>
        </div>
      </PracticeShell>
    );
  }

  return (
    <PracticeShell onExit={onExit}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="order-2 md:order-1">
          <PracticeCard
            key={currentVerse.id}
            reference={currentVerse.reference}
            stageIndex={stageIndex}
            recordsToSchedule={recordsToSchedule}
            position={boundedIndex}
            total={orderedVerses.length}
            onRecord={(tokens) =>
              void record({
                reference: currentVerse.reference,
                tokens,
                stage: stageIndex,
                mode: "practice",
              })
            }
            onPrev={() =>
              goToIndex(prevIndex(boundedIndex, orderedVerses.length))
            }
            onNext={() =>
              goToIndex(nextIndex(boundedIndex, orderedVerses.length))
            }
          />
        </div>
        <div className="order-1 md:order-2">
          <PracticeVerseRail
            verses={orderedVerses}
            activeId={currentVerse.id}
            onSelectVerse={handleSelectVerse}
            order={order}
            onOrderChange={handleOrderChange}
            stageIndex={stageIndex}
            onStageChange={setStageIndex}
          />
        </div>
      </div>
    </PracticeShell>
  );
}

interface PracticeCardProps {
  reference: CardReference;
  stageIndex: number;
  /** Whether an attempt at this stage records + reschedules (Hidden only). */
  recordsToSchedule: boolean;
  position: number;
  total: number;
  onRecord: (tokens: ReturnType<typeof diffWords>) => void;
  onPrev: () => void;
  onNext: () => void;
}

function PracticeCard({
  reference,
  stageIndex,
  recordsToSchedule,
  position,
  total,
  onRecord,
  onPrev,
  onNext,
}: PracticeCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  // The stage the current check result belongs to, or `null` when unchecked.
  // Deriving `checked` from it (rather than a boolean + effect) means changing
  // the scaffold mid-attempt drops the stale diff without a setState-in-effect.
  const [checkedStage, setCheckedStage] = useState<number | null>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  // Track the stage the current answer belongs to. When the selected stage
  // changes, a checked/graded answer is dropped and the input cleared so a
  // stale attempt can't be re-submitted at a new rung — a fresh attempt is
  // required after a check. Adjusting state during render (the sanctioned
  // pattern here, as in ReviewPlayer) avoids a setState-in-effect; verse
  // changes reset everything via the card `key`.
  const [answerStage, setAnswerStage] = useState(stageIndex);
  if (answerStage !== stageIndex) {
    setAnswerStage(stageIndex);
    if (checkedStage !== null) {
      setCheckedStage(null);
      setTypedAnswer("");
    }
  }

  const refLabel = formatVerseRef(reference);
  const { data, loading, error } = useEsvReference(reference);
  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";

  const stage = PRACTICE_STAGES[stageIndex] ?? PRACTICE_STAGES[0];
  const tokens = useMemo(
    () => maskVerseText(versePlainText, stage.stage),
    [versePlainText, stage.stage],
  );

  const checked = checkedStage === stageIndex;
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

  function checkAnswer() {
    if (!canCheckAnswer) return;
    // Guard against a single typed answer recording twice: once checked, a
    // fresh attempt (Try again / re-type / verse or stage change) is required.
    if (checked) return;
    const diffTokens = diffWords(typedAnswer, versePlainText);
    setCheckedStage(stageIndex);
    // Only the Hidden stage is scored; easier stages stay pure practice.
    if (recordsToSchedule) onRecord(diffTokens);
  }

  function tryAgain() {
    setCheckedStage(null);
    setTypedAnswer("");
    window.requestAnimationFrame(() => answerInputRef.current?.focus());
  }

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
      <Card className="mx-auto w-full overflow-hidden">
        <CardHeader className="gap-3 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Practice · {stage.label}
            </p>
            <CardTitle className="mt-2 text-3xl tracking-tight">
              {refLabel}
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Verse {position + 1} of {total}
          </p>
          <p className="text-xs text-muted-foreground/80">
            {recordsToSchedule
              ? "Hidden stage · this attempt counts toward your schedule"
              : "Practice only · switch to Hidden to log recall"}
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {!checked && (
            <>
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
                ) : stage.stage === "hidden" ? (
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
                onChange={(event) => setTypedAnswer(event.target.value)}
                onKeyDown={handleAnswerKeyDown}
                placeholder="Type what you remember"
                className="min-h-[150px] resize-none"
                aria-label="Your recalled verse"
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
                    <span className="mr-1 align-top text-xs font-semibold text-muted-foreground">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrev}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNext}
              className="gap-1.5"
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {checked ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={tryAgain}
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
          </div>
        </CardFooter>
      </Card>
    </motion.div>
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
  onExit,
  children,
}: {
  onExit: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="-ml-2 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Memory
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Practice</h1>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 py-6">{children}</div>
      </ScrollArea>
    </div>
  );
}
