import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  RotateCcw,
  SkipForward,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { StudyTeachCard } from "./study-teach-card";
import { StudyVerseMemoryCard } from "./study-verse-memory-card";
import {
  getCardKind,
  referenceKey,
  type PassageNote,
  type StudyCard,
} from "./study-card-model";
import { useStudyActivityDeckDebug } from "./use-study-activity-deck-debug";
import {
  StudyDeckCompleteState,
  StudyDeckEmptyState,
} from "./study-activity-deck-views";

/** Flashcard = free reveal/retry. Test = one-shot typed check (Memory Review). */
export type DeckInteraction = "flashcard" | "test";

interface StudyActivityDeckProps {
  cards: StudyCard[];
  scopeLabel: string;
  /** Optional tertiary footer action (e.g. "End review"). */
  onEndSession?: () => void;
  endSessionLabel?: string;
  /**
   * Interaction style for verse-memory cards. `"flashcard"` (default) allows
   * free Reveal / Try Again. `"test"` requires a typed answer, grades once on
   * Check, then only advances (Memory Review).
   */
  interaction?: DeckInteraction;
}

const TEACH_TIMER_SECONDS = 300;

type ExitDirection = "right" | "left";

const SHUFFLE_DURATION_MS = 750;
const SWIPE_DURATION_S = 0.32;
const MAX_STACK_VISIBLE = 3;

// Number of "dealer" cards that fly in on top of the settled stack during the
// initial entry animation. Each one flies in from alternating sides, briefly
// lands on the stack, then fades away to reveal the next one — giving a
// card-dealing feel without cluttering the view with a large visible pile.
// The final dealer card is the user's actual first card.
const DEAL_COUNT = 6;
const DEAL_STAGGER_S = 0.08;
const DEAL_FLY_IN_S = 0.16;
const DEAL_FADE_OUT_S = 0.12;

function settledStackPos(stackIdx: number) {
  return {
    x: 0,
    y: stackIdx * 10,
    rotate: 0,
    scale: 1 - stackIdx * 0.04,
    opacity: 1 - stackIdx * 0.3,
  };
}

const stackCardVariants: Variants = {
  exit: (direction: ExitDirection | null) => ({
    x: direction === "right" ? 420 : -420,
    rotate: direction === "right" ? 14 : -14,
    opacity: 0,
    transition: { duration: SWIPE_DURATION_S, ease: "easeIn" },
  }),
};

// The parent passes a fresh `key` whenever the active activity changes, so
// this component is remounted (and state reset) on activity switches.
export function StudyActivityDeck({
  cards,
  scopeLabel,
  onEndSession,
  endSessionLabel = "End session",
  interaction = "flashcard",
}: StudyActivityDeckProps): JSX.Element {
  const isTestMode = interaction === "test";
  // Compare by card-id *set*, not array reference. Parents (e.g. ReviewPlayer)
  // often pass a fresh `cards` array on Convex re-renders with the same ids;
  // resetting on reference inequality wiped completedIds mid-session.
  const cardsKey = useMemo(
    () => [...new Set(cards.map((c) => c.id))].sort().join("\u0000"),
    [cards],
  );
  const initialQueue = useMemo(() => cards.map((c) => c.id), [cards]);
  const cardsById = useMemo(() => {
    const map = new Map<string, StudyCard>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const [queue, setQueue] = useState<string[]>(() => initialQueue);
  const [queueSourceKey, setQueueSourceKey] = useState(cardsKey);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [typedById, setTypedById] = useState<Record<string, string>>({});
  const [extraNotesByRef, setExtraNotesByRef] = useState<
    Record<string, PassageNote[]>
  >({});
  const [isInitialShuffle, setIsInitialShuffle] = useState(true);
  // Bumped on restart to force the top-of-stack motion.divs to remount so
  // the entry animation replays.
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [exitDirection, setExitDirection] = useState<ExitDirection | null>(
    null,
  );

  // The active verse-memory card publishes its "persist this attempt" callback
  // here. Fired on Done (flashcard) or Check answer (test). The deck owns no
  // scheduling logic.
  const recordAttemptRef = useRef<(() => void) | null>(null);

  if (queueSourceKey !== cardsKey) {
    setQueueSourceKey(cardsKey);
    setQueue(initialQueue);
    setPosition(0);
    setFlipped(false);
    setCompletedIds(new Set());
    setTypedById({});
    setExitDirection(null);
    setIsInitialShuffle(true);
    setShuffleNonce((n) => n + 1);
  }

  // Play the entry deal animation once per mount (and once per restart, via
  // `shuffleNonce`). The parent re-mounts this component on activity switch
  // via `key={view}` so this also fires per activity.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setIsInitialShuffle(false),
      SHUFFLE_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [shuffleNonce]);

  const totalCards = cards.length;
  const isComplete = totalCards > 0 && queue.length === 0;

  const currentCardId = queue[position];
  const currentCard = currentCardId ? cardsById.get(currentCardId) : undefined;
  const currentTyped = currentCardId ? (typedById[currentCardId] ?? "") : "";
  const isTeachCard = currentCard?.type === "teach";

  // Per-card countdown for teach cards. Resets when the active teach card id
  // changes. Held at the initial value while the dealer animation plays so
  // the user gets the full window.
  const [secondsRemaining, setSecondsRemaining] = useState(TEACH_TIMER_SECONDS);
  const [timerCardId, setTimerCardId] = useState<string | null>(null);

  // React-recommended pattern for resetting state in response to a value
  // change: compare during render and setState synchronously (see
  // https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes).
  if (isTeachCard && currentCardId && timerCardId !== currentCardId) {
    setTimerCardId(currentCardId);
    setSecondsRemaining(TEACH_TIMER_SECONDS);
  }

  useEffect(() => {
    if (!isTeachCard || isInitialShuffle) return;
    if (secondsRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTeachCard, isInitialShuffle, secondsRemaining, currentCardId]);

  const visibleIds = useMemo(
    () => queue.slice(position, position + MAX_STACK_VISIBLE),
    [queue, position],
  );

  const { logAdvance, logRestart } = useStudyActivityDeckDebug({
    cards,
    initialQueue,
    queue,
    position,
    completedIdsSize: completedIds.size,
    currentCardId,
    cardsById,
  });

  function advanceCurrentCard() {
    if (!currentCardId) return;
    logAdvance("done", {
      position,
      queueLength: queue.length,
      completedCount: completedIds.size,
    });
    setExitDirection("right");
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.add(currentCardId);
      return next;
    });
    setTypedById((prev) => {
      if (!(currentCardId in prev)) return prev;
      const next = { ...prev };
      delete next[currentCardId];
      return next;
    });
    const pos = position;
    const nextQueue = [...queue];
    if (pos < nextQueue.length) {
      nextQueue.splice(pos, 1);
    }
    const nextPos =
      nextQueue.length === 0 ? 0 : Math.min(pos, nextQueue.length - 1);
    setQueue(nextQueue);
    setPosition(nextPos);
    setFlipped(false);
  }

  function handleCorrect() {
    if (!currentCardId || isInitialShuffle) return;
    // Flashcard: persist on Done. Test mode already persisted on Check.
    if (!isTestMode) {
      recordAttemptRef.current?.();
    }
    advanceCurrentCard();
  }

  function handleReveal() {
    if (isInitialShuffle || flipped) return;
    setFlipped(true);
  }

  function handleCheckAnswer() {
    if (isInitialShuffle || flipped) return;
    if (currentTyped.trim().length === 0) return;
    // Grade once: record on check so Skip/retry can't replace the attempt.
    recordAttemptRef.current?.();
    setFlipped(true);
  }

  function handleTryAgain() {
    if (isTestMode) return;
    setFlipped(false);
    if (currentCardId) {
      setTypedById((prev) => {
        if (!(currentCardId in prev)) return prev;
        const next = { ...prev };
        delete next[currentCardId];
        return next;
      });
    }
  }

  function handleSkip() {
    if (!currentCardId || isInitialShuffle) return;
    logAdvance("skip", {
      position,
      queueLength: queue.length,
      completedCount: completedIds.size,
    });
    setExitDirection("left");
    const pos = position;
    const nextQueue = [...queue];
    if (pos < nextQueue.length) {
      const [id] = nextQueue.splice(pos, 1);
      nextQueue.push(id);
    }
    setQueue(nextQueue);
    setTypedById((prev) => {
      if (!(currentCardId in prev)) return prev;
      const next = { ...prev };
      delete next[currentCardId];
      return next;
    });
    setFlipped(false);
  }

  function handleRestart() {
    logRestart({
      cardsLength: cards.length,
      initialQueueLength: initialQueue.length,
    });
    setQueue(initialQueue);
    setPosition(0);
    setFlipped(false);
    setCompletedIds(new Set());
    setTypedById({});
    setExitDirection(null);
    setSecondsRemaining(TEACH_TIMER_SECONDS);
    // Flip synchronously so the remounted motion.divs pick up the deal
    // entry `initial` values on their first render.
    setIsInitialShuffle(true);
    setShuffleNonce((n) => n + 1);
  }

  function handleTypedAnswerChange(value: string) {
    if (!currentCardId) return;
    setTypedById((prev) => ({ ...prev, [currentCardId]: value }));
  }

  function handlePassageNoteSaved(_cardId: string, note: PassageNote) {
    if (!currentCard || currentCard.type !== "teach") return;
    const key = referenceKey(currentCard.reference);
    setExtraNotesByRef((prev) => {
      const existing = prev[key] ?? [];
      if (existing.some((n) => n.noteId === note.noteId)) return prev;
      return { ...prev, [key]: [...existing, note] };
    });
  }

  // Enter: Reveal/Check on the front, Done/Next on the back. Shift+Enter still
  // inserts newlines in the recall textarea. Leave buttons alone so native
  // activation handles focused Skip / Reveal / Check / Try Again / Done / Next.
  const shortcutRef = useRef({
    flipped: false,
    isInitialShuffle: true,
    isComplete: false,
    canCheck: false,
    isTestMode: false,
    onFrontAction: () => {},
    onDone: () => {},
  });
  useEffect(() => {
    shortcutRef.current = {
      flipped,
      isInitialShuffle,
      isComplete,
      canCheck: currentTyped.trim().length > 0,
      isTestMode,
      onFrontAction: isTestMode ? handleCheckAnswer : handleReveal,
      onDone: handleCorrect,
    };
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      const s = shortcutRef.current;
      if (s.isComplete || s.isInitialShuffle) return;

      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toUpperCase();
        const role = active.getAttribute("role") ?? "";
        if (
          tag === "BUTTON" ||
          tag === "A" ||
          role === "button" ||
          role === "link"
        ) {
          return;
        }
      }

      if (s.flipped) {
        event.preventDefault();
        s.onDone();
        return;
      }
      // Test mode: require a typed answer before Check (no empty peek).
      if (s.isTestMode && !s.canCheck) return;
      event.preventDefault();
      s.onFrontAction();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (totalCards === 0) {
    return <StudyDeckEmptyState />;
  }

  if (isComplete || !currentCard) {
    return (
      <StudyDeckCompleteState
        cards={cards}
        scopeLabel={scopeLabel}
        onRestart={handleRestart}
      />
    );
  }

  const isTeachRevealed = isTeachCard && flipped;
  const deckContentMaxWidth = "max-w-2xl";

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("mx-auto w-full space-y-2", deckContentMaxWidth)}>
        {isTeachCard && !isInitialShuffle && (
          <div className="flex min-h-7 items-center justify-end">
            <TeachTimer secondsRemaining={secondsRemaining} />
          </div>
        )}
        <StudyDeckProgress
          cards={cards}
          completedIds={completedIds}
          currentIndex={completedIds.size}
        />
      </div>

      <motion.div
        layout
        className={cn(
          "relative mx-auto w-full",
          isTeachRevealed
            ? "max-w-5xl min-h-[680px]"
            : cn(deckContentMaxWidth, "min-h-[480px]"),
        )}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      >
        {/*
          Base stack sits statically in its settled 3-card layout. During the
          initial deal, top-card real content is hidden behind a stub so
          the dealer overlay can animate on top of a clean pile without
          fighting with rendered text. When a teach card is flipped to its
          reveal panel we hide the peek cards entirely so the "stack" motif
          stays purely visual on the front.
        */}
        <AnimatePresence custom={exitDirection}>
          {visibleIds.map((cardId, stackIdx) => {
            const card = cardsById.get(cardId);
            if (!card) return null;
            const isTop = stackIdx === 0;
            if (!isTop && isTeachRevealed) return null;
            const settled = settledStackPos(stackIdx);
            return (
              <motion.div
                key={`${shuffleNonce}-${cardId}`}
                layout
                className="absolute inset-0"
                style={{ zIndex: 10 - stackIdx }}
                custom={exitDirection}
                variants={stackCardVariants}
                initial={settled}
                animate={settled}
                transition={{ duration: 0.28, ease: "easeOut" }}
                exit="exit"
              >
                {isTop ? (
                  <div className="h-full w-full">
                    {card.type === "verse-memory" ? (
                      <StudyVerseMemoryCard
                        card={card}
                        flipped={flipped}
                        typedAnswer={currentTyped}
                        onTypedAnswerChange={handleTypedAnswerChange}
                        recordRef={recordAttemptRef}
                        attemptMode={isTestMode ? "review" : "deck"}
                      />
                    ) : (
                      <StudyTeachCard
                        card={card}
                        flipped={flipped}
                        typedAnswer={currentTyped}
                        onTypedAnswerChange={handleTypedAnswerChange}
                        extraPassageNotes={
                          extraNotesByRef[referenceKey(card.reference)] ?? []
                        }
                        onPassageNoteSaved={handlePassageNoteSaved}
                      />
                    )}
                  </div>
                ) : (
                  <div className="pointer-events-none h-full w-full overflow-hidden rounded-xl border bg-card shadow-sm">
                    <StackedCardStub card={card} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {isInitialShuffle && currentCard && (
            <ShuffleDealerOverlay
              key={`dealer-${shuffleNonce}`}
              cards={cards}
              firstCard={currentCard}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <div className={cn("mx-auto w-full space-y-2 pt-1", deckContentMaxWidth)}>
        {!flipped ? (
          <div className="flex items-stretch gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={handleSkip}
              disabled={isInitialShuffle}
              aria-label="Skip card"
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
            {isTestMode ? (
              <Button
                type="button"
                size="lg"
                className="min-w-0 flex-1 gap-1.5"
                onClick={handleCheckAnswer}
                disabled={isInitialShuffle || currentTyped.trim().length === 0}
              >
                <CheckCircle2 className="h-4 w-4" />
                Check answer
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="min-w-0 flex-1 gap-1.5"
                onClick={handleReveal}
                disabled={isInitialShuffle}
              >
                <Eye className="h-4 w-4" />
                Reveal
              </Button>
            )}
          </div>
        ) : isTestMode ? (
          <Button
            type="button"
            size="lg"
            className="w-full gap-1.5"
            onClick={handleCorrect}
            disabled={isInitialShuffle}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="gap-1.5"
              onClick={handleTryAgain}
              disabled={isInitialShuffle}
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              type="button"
              size="lg"
              className="gap-1.5"
              onClick={handleCorrect}
              disabled={isInitialShuffle}
            >
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        )}
        {onEndSession && (
          <div className="flex justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={onEndSession}
              disabled={isInitialShuffle}
            >
              {endSessionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StackedCardStub({ card }: { card: StudyCard }): JSX.Element {
  const label =
    card.type === "verse-memory" ? formatVerseRef(card.reference) : "Teach";
  return (
    <div className="flex h-full w-full items-start justify-center px-6 py-6">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ShuffleDealerOverlay({
  cards,
  firstCard,
}: {
  cards: StudyCard[];
  firstCard: StudyCard;
}): JSX.Element {
  const samples = useMemo<StudyCard[]>(() => {
    const others = cards.filter((c) => c.id !== firstCard.id);
    const leadIns: StudyCard[] = [];
    for (let i = 0; i < DEAL_COUNT - 1; i++) {
      const pick =
        others.length > 0
          ? (others[(i * 3 + 1) % others.length] ?? firstCard)
          : firstCard;
      leadIns.push(pick);
    }
    return [...leadIns, firstCard];
  }, [cards, firstCard]);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 50 }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeOut" } }}
    >
      {samples.map((sample, i) => (
        <ShuffleDealerCard
          key={`${i}-${sample.id}`}
          index={i}
          card={sample}
          isLast={i === samples.length - 1}
        />
      ))}
    </motion.div>
  );
}

function ShuffleDealerCard({
  index,
  card,
  isLast,
}: {
  index: number;
  card: StudyCard;
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
      <ShuffleDealerCardFace card={card} />
    </motion.div>
  );
}

function ShuffleDealerCardFace({ card }: { card: StudyCard }): JSX.Element {
  const refLabel = formatVerseRef(card.reference);
  if (card.type === "verse-memory") {
    return (
      <div className="flex h-full w-full flex-col items-center gap-4 px-6 py-7 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {refLabel}
        </h2>
        <p className="text-sm text-muted-foreground">
          Can you recall this verse?
        </p>
        <div className="min-h-[160px] w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-muted-foreground/50">
          Type what you remember
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col gap-4 px-6 py-8">
      <h2 className="shrink-0 text-center text-2xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>
      <div className="mx-auto w-full max-w-xl space-y-2 px-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
      </div>
      <div className="mx-auto min-h-[120px] w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-muted-foreground/50">
        Practice teaching a point on this passage. Then reveal to compare with
        your notes.
      </div>
    </div>
  );
}

function StudyDeckProgress({
  cards,
  completedIds,
  currentIndex,
}: {
  cards: StudyCard[];
  completedIds: Set<string>;
  currentIndex: number;
}): JSX.Element {
  const counts = useMemo(() => {
    let totalVerses = 0;
    let totalNotes = 0;
    let doneVerses = 0;
    let doneNotes = 0;
    for (const card of cards) {
      const kind = getCardKind(card);
      if (kind === "verse") {
        totalVerses += 1;
        if (completedIds.has(card.id)) doneVerses += 1;
      } else {
        totalNotes += 1;
        if (completedIds.has(card.id)) doneNotes += 1;
      }
    }
    return { totalVerses, totalNotes, doneVerses, doneNotes };
  }, [cards, completedIds]);

  const total = cards.length;
  const versePct = total === 0 ? 0 : (counts.doneVerses / total) * 100;
  const notePct = total === 0 ? 0 : (counts.doneNotes / total) * 100;
  const hasVerses = counts.totalVerses > 0;
  const hasNotes = counts.totalNotes > 0;

  return (
    <div className="space-y-2">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {hasVerses && (
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${versePct}%` }}
          />
        )}
        {hasNotes && (
          <div
            className="h-full bg-chart-2 transition-[width]"
            style={{ width: `${notePct}%` }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3 font-medium normal-case tracking-normal">
          {hasVerses && (
            <LegendItem
              colorClass="bg-primary"
              label={`${counts.doneVerses}/${counts.totalVerses} hearted verse${counts.totalVerses !== 1 ? "s" : ""}`}
            />
          )}
          {hasNotes && (
            <LegendItem
              colorClass="bg-chart-2"
              label={`${counts.doneNotes}/${counts.totalNotes} passage${counts.totalNotes !== 1 ? "s" : ""}`}
            />
          )}
        </div>
        <p className="tabular-nums">
          {Math.min(currentIndex + 1, total)} of {total}
        </p>
      </div>
    </div>
  );
}

function LegendItem({
  colorClass,
  label,
}: {
  colorClass: string;
  label: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("inline-block h-2 w-2 rounded-full", colorClass)}
        aria-hidden
      />
      {label}
    </span>
  );
}

function TeachTimer({
  secondsRemaining,
}: {
  secondsRemaining: number;
}): JSX.Element {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isExpired = secondsRemaining <= 0;
  const isLow = secondsRemaining > 0 && secondsRemaining <= 30;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums",
        isExpired
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : isLow
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "border-border bg-muted text-muted-foreground",
      )}
      aria-label={isExpired ? "Time's up" : `Time remaining ${label}`}
    >
      <Timer className="h-3 w-3" aria-hidden />
      {isExpired ? "Time's up" : label}
    </div>
  );
}
