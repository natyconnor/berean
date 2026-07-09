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
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { diffWords } from "@/lib/diff-words";
import { MAX_LEARN_STAGE, requiredRepsFor } from "@/lib/memory-scheduler";
import {
  buildPracticeOrder,
  nextIndex,
  type PracticeOrder,
  prevIndex,
} from "@/lib/practice-order";
import { cn } from "@/lib/utils";
import {
  type HintToken,
  countVerseWords,
  hintForProgress,
  maskVerseText,
} from "@/lib/verse-hint";
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
  /** Server-authoritative memory rung for this verse (0..3). */
  learnStage: number;
  /**
   * Server-authoritative exact reps banked on the current band. Optional so
   * callers that don't (yet) surface it fall back to a fresh band; read
   * defensively via `stageReps ?? 0`.
   */
  stageReps?: number;
}

interface PracticeBoardProps {
  /** The verse set to practice (e.g. the user's hearted verses or a pack). */
  verses: ReadonlyArray<PracticeVerse>;
  /** Return to the memory home. */
  onExit: () => void;
}

/** Live learning progress the board tracks per verse this session. */
interface VerseProgress {
  learnStage: number;
  stageReps: number;
}

interface OrderedVerse {
  id: string;
  reference: CardReference;
  learnStage: number;
  stageReps: number;
}

const SHUFFLE_DURATION_MS = 750;
const DEAL_COUNT = 6;
const DEAL_STAGGER_S = 0.08;
const DEAL_FLY_IN_S = 0.16;
const DEAL_FADE_OUT_S = 0.12;

function normalizeStageIndex(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.min(MAX_LEARN_STAGE, Math.max(0, Math.trunc(stage)));
}

function normalizeReps(reps: number): number {
  if (!Number.isFinite(reps)) return 0;
  return Math.max(0, Math.trunc(reps));
}

/**
 * The Practice board: a focused, self-directed surface. One verse card at a
 * time, a verse rail to jump around, a Shuffle / In-order toggle, and prev/next
 * navigation.
 *
 * Practice counts fully: every attempt records with `mode: "practice"` and
 * reschedules exactly like Review. The card is driven entirely by the server's
 * `learnStage` + `stageReps`: a Read prime, then the fading support bands
 * (Guided → Challenge → From Memory) that re-randomize and thin their hints per
 * rep. Each recorded attempt adopts the returned `learnStage`/`stageReps`, so
 * the dial advances (exact), holds (close), or steps support back up (off)
 * live in-session.
 */
export function PracticeBoard({
  verses,
  onExit,
}: PracticeBoardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState<PracticeOrder>("in-order");
  // Bumped each time the user (re-)selects Shuffle so repeated presses reshuffle
  // deterministically without depending on Math.random().
  const [seed, setSeed] = useState(0);
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { record } = useRecordVerseAttempt();

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
    })),
  );

  // Live per-verse learning progress. Seeded from the frozen snapshot, then
  // advanced by adopting the server-authoritative `learnStage`/`stageReps`
  // returned by each recorded attempt, so the fade dial moves in-session.
  const [progressByVerseId, setProgressByVerseId] = useState<
    Record<string, VerseProgress>
  >(() =>
    Object.fromEntries(
      baseVerses.map((verse) => [
        verse.id,
        { learnStage: verse.learnStage, stageReps: verse.stageReps },
      ]),
    ),
  );

  // Per-verse attempt bookkeeping for out-of-order resolution. `attemptSeq`
  // assigns a monotonic id at send time; `appliedSeq` records the newest attempt
  // whose result we actually adopted. A settled response updates progress only
  // when it carries a schedule (non-null) and is newer than the last adopted
  // one — so neither a slower earlier attempt nor a newer *failed* (null)
  // attempt can strand the dial behind the server.
  const attemptSeqByVerseId = useRef<Map<string, number>>(new Map());
  const appliedSeqByVerseId = useRef<Map<string, number>>(new Map());

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
        };
      }),
    [orderedVerses, progressByVerseId],
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
      })
    : { learnStage: 0, stageReps: 0 };

  // Fetch the active verse's text (cache-shared with PracticeCard) so the rail
  // can show a length-accurate rep total via requiredRepsFor.
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
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="order-2 md:order-1">
          <div className="relative">
            <PracticeCard
              key={currentVerse.id}
              reference={currentVerse.reference}
              learnStage={currentProgress.learnStage}
              stageReps={currentProgress.stageReps}
              position={boundedIndex}
              total={orderedVerses.length}
              onRecord={(tokens, wordCount) => {
                const verseId = currentVerse.id;
                const seq = (attemptSeqByVerseId.current.get(verseId) ?? 0) + 1;
                attemptSeqByVerseId.current.set(verseId, seq);
                return record({
                  reference: currentVerse.reference,
                  tokens,
                  stage: currentProgress.learnStage,
                  mode: "practice",
                  wordCount,
                }).then((schedule) => {
                  if (!schedule) return;
                  // Adopt only the newest *successful* result. A failed/no-op
                  // attempt resolves to null and never advances `appliedSeq`, so
                  // a slower earlier success can't be discarded by it; and once
                  // a newer success has landed, this older one is dropped.
                  const applied = appliedSeqByVerseId.current.get(verseId) ?? 0;
                  if (seq <= applied) return;
                  appliedSeqByVerseId.current.set(verseId, seq);
                  // Adopt the server-authoritative band + reps so the dial
                  // advances (exact), holds (close), or steps support back up
                  // (off) live in-session.
                  setProgressByVerseId((prev) => ({
                    ...prev,
                    [verseId]: {
                      learnStage: normalizeStageIndex(schedule.learnStage),
                      stageReps: normalizeReps(schedule.stageReps),
                    },
                  }));
                });
              }}
              onPrev={() =>
                goToIndex(prevIndex(boundedIndex, orderedVerses.length))
              }
              onNext={() =>
                goToIndex(nextIndex(boundedIndex, orderedVerses.length))
              }
            />
            <AnimatePresence>
              {isShuffling && (
                <PracticeShuffleOverlay
                  key={`practice-shuffle-${shuffleNonce}`}
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
            verses={railVerses}
            activeId={currentVerse.id}
            onSelectVerse={handleSelectVerse}
            order={order}
            onOrderChange={handleOrderChange}
            shuffleNonce={shuffleNonce}
            currentLearnStage={currentProgress.learnStage}
            currentStageReps={currentProgress.stageReps}
            currentWordCount={currentWordCount}
          />
        </div>
      </div>
    </PracticeShell>
  );
}

interface PracticeCardProps {
  reference: CardReference;
  /** Server-authoritative band for this verse (0..3). */
  learnStage: number;
  /** Server-authoritative exact reps banked on the current band. */
  stageReps: number;
  position: number;
  total: number;
  onRecord: (
    tokens: ReturnType<typeof diffWords>,
    wordCount: number,
  ) => Promise<void>;
  onPrev: () => void;
  onNext: () => void;
}

function PracticeCard({
  reference,
  learnStage,
  stageReps,
  position,
  total,
  onRecord,
  onPrev,
  onNext,
}: PracticeCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [typedAnswer, setTypedAnswer] = useState("");
  // Whether the current answer has been checked (and thus recorded). Persists
  // through the resulting band/rep change so the feedback stays visible until
  // the learner continues.
  const [checked, setChecked] = useState(false);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
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
  const stageColor = stageInfo.color;
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

  const isReadPrime = hintStage === "full";
  const requiredReps = requiredRepsFor(learnStage, wordCount);
  // Only the multi-rep fading bands (Guided, Challenge) show a rep counter; the
  // single-rep Read prime and From Memory recall don't.
  const repLabel =
    requiredReps > 1
      ? `rep ${Math.min(stageReps + 1, requiredReps)} of ${requiredReps}`
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

  function checkAnswer() {
    if (!canCheckAnswer || checked) return;
    // Practice counts fully: every checked attempt records and reschedules. The
    // lock keeps a double-tap from recording twice before the result view
    // (driven by `checked`) mounts and replaces this button.
    submit(() => {
      setChecked(true);
      return onRecord(diffWords(typedAnswer, versePlainText), wordCount ?? 0);
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
    submit(() =>
      onRecord(diffWords(versePlainText, versePlainText), wordCount ?? 0),
    );
  }

  function continueAttempt() {
    setChecked(false);
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
              Practice · {stageInfo.label}
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
        </CardHeader>

        <CardContent className="space-y-5">
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
                      No hint text. Type the verse from memory, then check your
                      answer.
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
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={continueAttempt}
                // Hold until the attempt settles: this both keeps the submit
                // lock from swallowing the next check (resetting the question
                // mid-flight would strand it) and ensures the adopted band/reps
                // land before the next rep renders, so it can't re-record stale.
                disabled={submitPending}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Continue
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
  verses,
  firstVerse,
}: {
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
          index={index}
          verse={sample}
          isLast={index === samples.length - 1}
        />
      ))}
    </motion.div>
  );
}

function PracticeShuffleCard({
  index,
  verse,
  isLast,
}: {
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
      <PracticeShuffleCardFace verse={verse} />
    </motion.div>
  );
}

function PracticeShuffleCardFace({
  verse,
}: {
  verse: OrderedVerse;
}): JSX.Element {
  const refLabel = formatVerseRef(verse.reference);
  const stage = PRACTICE_STAGES[verse.learnStage] ?? PRACTICE_STAGES[0];
  const stageColor = stage.color;

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
          Practice · {stage.label}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {refLabel}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Shuffling your practice order
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
        <div className="mx-auto max-w-6xl px-5 py-6">{children}</div>
      </ScrollArea>
    </div>
  );
}
