import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type MutableRefObject,
} from "react";

import { Textarea } from "@/components/ui/textarea";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { diffWords, type DiffToken } from "@/lib/diff-words";
import { MAX_LEARN_STAGE, type MemorySchedule } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { FlipFaces } from "./flip-faces";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import type {
  CardReference,
  VerseMemoryCard as VerseMemoryCardData,
} from "./study-card-model";
import {
  useRecordVerseAttempt,
  type VerseAttemptMode,
} from "./use-record-verse-attempt";
import { VerseMemoryFeedback } from "./verse-memory-feedback";

const ESV_FADE_S = 0.3;

/** Modes the deck card can persist; learn/practice use other surfaces. */
type DeckAttemptMode = Extract<VerseAttemptMode, "deck" | "review">;

/** Fired when a deck card successfully grades a typed recall. */
export interface GradedDeckAttempt {
  reference: CardReference;
  accuracy: number;
}

interface StudyVerseMemoryCardProps {
  card: VerseMemoryCardData;
  flipped: boolean;
  typedAnswer: string;
  onTypedAnswerChange: (value: string) => void;
  /**
   * When provided, the card publishes a "record this attempt" callback here so
   * the deck can persist the attempt on check/completion without owning any
   * scheduling logic itself.
   */
  recordRef?: MutableRefObject<(() => void) | null>;
  /** Persistence mode for graded recalls. Defaults to `"deck"`. */
  attemptMode?: DeckAttemptMode;
  /** Optional session listener for graded accuracy (e.g. review summary). */
  onAttemptGraded?: (attempt: GradedDeckAttempt) => void;
}

interface VerseAttemptResultProps {
  typedAnswer: string;
  versePlainText: string;
  diffTokens?: ReadonlyArray<DiffToken>;
  /** Review mode: show schedule-consequence copy above the diff. */
  showScheduleOutcome?: boolean;
  nextSchedule?: MemorySchedule | null;
  now?: number;
}

const PLACEHOLDER = "\u00a0";

function renderDiffChip(token: DiffToken, idx: number): JSX.Element {
  if (token.status === "match") {
    return (
      <span
        key={idx}
        className="inline-flex min-h-6 items-center rounded-md bg-emerald-500/10 px-1.5 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300"
      >
        {token.text}
      </span>
    );
  }

  const typedText = token.status === "missing" ? PLACEHOLDER : token.text;
  const expectedText =
    token.status === "extra"
      ? PLACEHOLDER
      : token.status === "mismatch"
        ? (token.expectedText ?? PLACEHOLDER)
        : token.text;

  const baseRow = "min-h-5 rounded-md px-1.5 text-center text-[13px] leading-5";

  const typedClassName = cn(
    baseRow,
    (token.status === "mismatch" || token.status === "extra") &&
      "bg-rose-500/10 text-rose-600 line-through decoration-rose-500/60 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300",
    token.status === "missing" &&
      "border border-dashed border-amber-500/60 text-transparent",
  );

  const expectedClassName = cn(
    baseRow,
    (token.status === "mismatch" || token.status === "missing") &&
      "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-200",
    token.status === "extra" &&
      "border border-dashed border-rose-500/40 text-transparent",
  );

  const ariaLabel =
    token.status === "missing"
      ? `Missing word: ${token.text}`
      : token.status === "extra"
        ? `Extra word: ${token.text}`
        : `Different word: ${token.text}${
            token.expectedText ? `, expected ${token.expectedText}` : ""
          }`;

  return (
    <span
      key={idx}
      className="inline-flex flex-col items-stretch gap-0.5 align-top"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className={typedClassName}>{typedText}</span>
      <span className={expectedClassName}>{expectedText}</span>
    </span>
  );
}

function VerseAttemptDiff({
  tokens,
}: {
  tokens: ReadonlyArray<DiffToken>;
}): JSX.Element {
  const accuracy = verseAttemptAccuracy(tokens);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{accuracy}% recalled</span>
        <span className="flex items-center gap-2 font-medium normal-case tracking-normal">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-emerald-500/40" />
            correct
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-rose-500/40" />
            you
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-amber-500/40" />
            verse
          </span>
        </span>
      </div>
      <p className="flex flex-wrap gap-x-1.5 gap-y-2 text-[13px] leading-5">
        {tokens.map((token, idx) => renderDiffChip(token, idx))}
      </p>
    </div>
  );
}

export function VerseAttemptResult({
  typedAnswer,
  versePlainText,
  diffTokens: providedDiffTokens,
  showScheduleOutcome = false,
  nextSchedule = null,
  now,
}: VerseAttemptResultProps): JSX.Element | null {
  const trimmedTyped = typedAnswer.trim();
  if (trimmedTyped.length === 0 || versePlainText.length === 0) return null;

  const diffTokens =
    providedDiffTokens ?? diffWords(typedAnswer, versePlainText);
  const attemptQuality = classifyVerseAttempt(diffTokens);
  // Used as a motion key so the feedback banner re-plays its entrance when
  // the user tries a different attempt, but not on every keystroke.
  const attemptKey = trimmedTyped;

  return (
    <div className="w-full max-w-xl mx-auto space-y-2">
      {attemptQuality && (showScheduleOutcome || attemptQuality !== "off") && (
        <VerseMemoryFeedback
          quality={attemptQuality}
          attemptKey={attemptKey}
          showScheduleOutcome={showScheduleOutcome}
          nextSchedule={nextSchedule}
          now={now}
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className={cn(
          "space-y-3 rounded-xl border bg-card/60 px-4 py-3 shadow-sm backdrop-blur-sm",
          attemptQuality === "exact"
            ? "border-emerald-500/40"
            : attemptQuality === "close"
              ? "border-amber-500/40"
              : "border-primary/25",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          How you did
        </p>
        <VerseAttemptDiff tokens={diffTokens} />
      </motion.div>
    </div>
  );
}

export function StudyVerseMemoryCard({
  card,
  flipped,
  typedAnswer,
  onTypedAnswerChange,
  recordRef,
  attemptMode = "deck",
  onAttemptGraded,
}: StudyVerseMemoryCardProps): JSX.Element {
  const refLabel = formatVerseRef(card.reference);
  const showScheduleOutcome = attemptMode === "review";
  const [nextSchedule, setNextSchedule] = useState<MemorySchedule | null>(null);
  const [scheduleCardId, setScheduleCardId] = useState(card.id);
  const [outcomeNow, setOutcomeNow] = useState(() => Date.now());

  // Reset outcome state when the deck advances to a new verse (render-time
  // sync — avoids setState-in-effect).
  if (scheduleCardId !== card.id) {
    setScheduleCardId(card.id);
    setNextSchedule(null);
  }

  // Fetch eagerly (not gated on `flipped`) so the verse text is cached and
  // ready the moment the user reveals the back of the card. The result is
  // only rendered on the back face, so this is pure prefetch.
  const { data, loading, error } = useEsvReference(card.reference);

  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";

  const { record } = useRecordVerseAttempt();
  // Holds a completed-but-ungradable typed answer (check/Done before the ESV
  // text arrived) so the flush effect can persist it once text is available.
  const pendingDeckTypedRef = useRef<string | null>(null);

  // Persist a recall. Deck/review recall is always the fully-hidden rung, so it
  // is logged as such. Returns whether it actually fired (needs verse text).
  const recordDeckAttempt = useCallback(
    (typed: string): boolean => {
      if (typed.trim().length === 0 || versePlainText.length === 0) {
        return false;
      }
      const tokens = diffWords(typed, versePlainText);
      const accuracy = verseAttemptAccuracy(tokens);
      setOutcomeNow(Date.now());
      setNextSchedule(null);
      void record({
        reference: card.reference,
        tokens,
        stage: MAX_LEARN_STAGE,
        mode: attemptMode,
      }).then((schedule) => {
        if (schedule) setNextSchedule(schedule);
      });
      onAttemptGraded?.({
        reference: card.reference,
        accuracy,
      });
      return true;
    },
    [record, card.reference, versePlainText, attemptMode, onAttemptGraded],
  );

  useEffect(() => {
    if (!recordRef) return;
    recordRef.current = () => {
      if (typedAnswer.trim().length === 0) return;
      // If the ESV text isn't ready yet, stash the answer and let it flush once
      // text arrives (the card stays mounted through its exit animation) rather
      // than silently dropping a completed attempt.
      if (!recordDeckAttempt(typedAnswer)) {
        pendingDeckTypedRef.current = typedAnswer;
      }
    };
    return () => {
      recordRef.current = null;
    };
  }, [recordRef, recordDeckAttempt, typedAnswer]);

  // Flush a deferred completion once the verse text loads.
  useEffect(() => {
    const pendingTyped = pendingDeckTypedRef.current;
    if (pendingTyped === null || versePlainText.length === 0) return;
    pendingDeckTypedRef.current = null;
    recordDeckAttempt(pendingTyped);
  }, [versePlainText, recordDeckAttempt]);

  const front = (
    <div className="flex h-full w-full flex-col items-center gap-4 px-6 py-7 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>
      <p className="text-sm text-muted-foreground">
        Can you recall this verse?
      </p>
      <Textarea
        value={typedAnswer}
        onChange={(e) => onTypedAnswerChange(e.target.value)}
        placeholder="Type what you remember"
        className="min-h-[160px] w-full max-w-xl resize-none"
        aria-label="Your recalled verse"
      />
    </div>
  );

  const back = (
    <div className="flex h-full w-full flex-col gap-4 overflow-auto px-6 py-7">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>

      {flipped && (
        <VerseAttemptResult
          typedAnswer={typedAnswer}
          versePlainText={versePlainText}
          showScheduleOutcome={showScheduleOutcome}
          nextSchedule={nextSchedule}
          now={outcomeNow}
        />
      )}

      <div className="w-full max-w-xl mx-auto space-y-2 text-left text-base leading-relaxed text-foreground">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="loading"
              className="space-y-2 px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ESV_FADE_S, ease: "easeOut" }}
            >
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
            </motion.div>
          ) : error ? (
            <motion.p
              key="error"
              className="text-sm text-destructive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ESV_FADE_S, ease: "easeOut" }}
            >
              Could not load verse text.
            </motion.p>
          ) : data ? (
            <motion.div
              key="data"
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ESV_FADE_S, ease: "easeOut" }}
            >
              {data.verses.map((verse) => (
                <p key={verse.number}>
                  <span className="mr-1 text-xs font-semibold text-muted-foreground align-top">
                    {verse.number}
                  </span>
                  {verse.text}
                </p>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <FlipFaces
      flipped={flipped}
      front={front}
      back={back}
      className="h-full w-full"
      faceClassName="rounded-xl border bg-card shadow-sm overflow-hidden"
    />
  );
}
