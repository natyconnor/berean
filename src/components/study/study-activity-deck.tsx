import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Shuffle, SkipForward, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { StudyTeachCard } from "./study-teach-card";
import { StudyVerseMemoryCard } from "./study-verse-memory-card";
import {
  activityLabel,
  getCardKind,
  referenceKey,
  type ActivityType,
  type PassageNote,
  type StudyCard,
} from "./study-card-model";
import { useStudyActivityDeckDebug } from "./use-study-activity-deck-debug";
import {
  StudyDeckCompleteState,
  StudyDeckEmptyState,
} from "./study-activity-deck-views";

interface StudyActivityDeckProps {
  cards: StudyCard[];
  scopeLabel: string;
}

const TEACH_TIMER_SECONDS = 300;

/** Random order (Fisher–Yates); distinct from build-time deterministic shuffle. */
function randomizeCardIds(cards: StudyCard[]): string[] {
  const ids = cards.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

type ExitDirection = "right" | "left";

const SHUFFLE_DURATION_MS = 750;
const SWIPE_DURATION_S = 0.32;
const MAX_STACK_VISIBLE = 3;

// Number of "dealer" cards that fly in on top of the settled stack during the
// initial shuffle. Each one flies in from alternating sides, briefly lands on
// the stack, then fades away to reveal the next one — giving a card-dealing
// feel without cluttering the view with a large visible pile. The final
// dealer card is the user's actual first card, which is what they'll see
// when the overlay clears.
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
}: StudyActivityDeckProps) {
  const initialQueue = useMemo(() => cards.map((c) => c.id), [cards]);
  const cardsById = useMemo(() => {
    const map = new Map<string, StudyCard>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const [queue, setQueue] = useState<string[]>(() => initialQueue);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [typedById, setTypedById] = useState<Record<string, string>>({});
  const [extraNotesByRef, setExtraNotesByRef] = useState<
    Record<string, PassageNote[]>
  >({});
  const [isInitialShuffle, setIsInitialShuffle] = useState(true);
  // Bumped on restart to force the top-of-stack motion.divs to remount so
  // the shuffle entry animation replays.
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [exitDirection, setExitDirection] = useState<ExitDirection | null>(
    null,
  );

  // Play the shuffle animation once per mount (and once per restart, via
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

  const { logAdvance, logRestart, logShuffle } = useStudyActivityDeckDebug({
    cards,
    initialQueue,
    queue,
    position,
    completedIdsSize: completedIds.size,
    currentCardId,
    cardsById,
  });

  function handleCorrect() {
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

  function handleTryAgain() {
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
    if (!currentCardId) return;
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
    // Flip synchronously so the remounted motion.divs pick up the shuffle
    // entry `initial` values on their first render.
    setIsInitialShuffle(true);
    setShuffleNonce((n) => n + 1);
  }

  function handleShuffle() {
    if (totalCards < 2) return;
    logShuffle({ cardsLength: cards.length });
    setQueue(randomizeCardIds(cards));
    setPosition(0);
    setFlipped(false);
    setCompletedIds(new Set());
    setTypedById({});
    setExitDirection(null);
    setSecondsRemaining(TEACH_TIMER_SECONDS);
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

  if (totalCards === 0) {
    return <StudyDeckEmptyState />;
  }

  if (isComplete || !currentCard) {
    return (
      <StudyDeckCompleteState
        cards={cards}
        scopeLabel={scopeLabel}
        onRestart={handleRestart}
        onShuffle={handleShuffle}
      />
    );
  }

  const currentCardActivity: ActivityType = currentCard.type;

  const isTeachRevealed = isTeachCard && flipped;

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-2xl space-y-2">
        <div className="relative flex min-h-7 items-center justify-center">
          {totalCards >= 2 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute left-0 h-7 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleShuffle}
              disabled={isInitialShuffle}
              aria-label="Shuffle deck and start over"
            >
              <Shuffle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Shuffle</span>
            </Button>
          )}
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {activityLabel(currentCardActivity)}
          </p>
          {isTeachCard && !isInitialShuffle && (
            <TeachTimer secondsRemaining={secondsRemaining} />
          )}
        </div>
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
            : "max-w-2xl min-h-[520px]",
        )}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      >
        {/*
          Base stack sits statically in its settled 3-card layout. During the
          initial shuffle, top-card real content is hidden behind a stub so
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
                  <div className="pointer-events-none h-full w-full rounded-xl border bg-card shadow-sm overflow-hidden">
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

      <div className="mx-auto w-full max-w-2xl pt-1">
        {!flipped ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="gap-1"
              onClick={handleSkip}
              disabled={isInitialShuffle}
              aria-label="Skip card"
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => setFlipped(true)}
              disabled={isInitialShuffle}
            >
              Reveal
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleTryAgain}
              disabled={isInitialShuffle}
            >
              Try Again
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleCorrect}
              disabled={isInitialShuffle}
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StackedCardStub({ card }: { card: StudyCard }) {
  const label = card.type === "verse-memory" ? "Verse Memory" : "Teach";
  return (
    <div className="flex h-full w-full items-start justify-center py-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
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
}) {
  const samples = useMemo<StudyCard[]>(() => {
    const others = cards.filter((c) => c.id !== firstCard.id);
    const leadIns: StudyCard[] = [];
    for (let i = 0; i < DEAL_COUNT - 1; i++) {
      const pick =
        others.length > 0 ? others[(i * 3 + 1) % others.length] : firstCard;
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
}) {
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
      className="absolute inset-0 rounded-xl border bg-card shadow-md overflow-hidden"
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

function ShuffleDealerCardFace({ card }: { card: StudyCard }) {
  const refLabel = formatVerseRef(card.reference);
  if (card.type === "verse-memory") {
    return (
      <div className="flex h-full w-full flex-col items-center gap-5 px-6 py-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {refLabel}
        </h2>
        <p className="text-sm text-muted-foreground">
          Can you recall this verse?
        </p>
        <div className="w-full max-w-xl min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-muted-foreground/50">
          Type what you remember (optional)
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col gap-4 px-6 py-8">
      <h2 className="shrink-0 text-center text-2xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>
      <div className="w-full max-w-xl mx-auto space-y-2 px-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
      </div>
      <div className="w-full max-w-xl mx-auto min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-muted-foreground/50">
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
}) {
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
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
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
        <p>
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
}) {
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

function TeachTimer({ secondsRemaining }: { secondsRemaining: number }) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isExpired = secondsRemaining <= 0;
  const isLow = secondsRemaining > 0 && secondsRemaining <= 30;
  return (
    <div
      className={cn(
        "absolute right-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-mono tabular-nums",
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
