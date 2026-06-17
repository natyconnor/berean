import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { StudyActivityDeck } from "./study-activity-deck";
import { StudyDeckEmptyState } from "./study-activity-deck-views";
import type { StudyCard, VerseMemoryCard } from "./study-card-model";
import { StudyVerseLearn } from "./study-verse-learn";
import {
  StudyVerseMemoryControls,
  type VerseStudyMode,
} from "./study-verse-memory-controls";

interface StudyVerseMemoryViewProps {
  cards: StudyCard[];
  scopeLabel: string;
}

const INITIAL_MODE = {
  kind: "all",
  order: "in-order",
  nonce: 0,
} satisfies VerseStudyMode;

export function StudyVerseMemoryView({
  cards,
  scopeLabel,
}: StudyVerseMemoryViewProps) {
  const [mode, setMode] = useState<VerseStudyMode>(INITIAL_MODE);
  const [controlsOpen, setControlsOpen] = useState(false);
  const verseCards = useMemo(
    () =>
      cards.filter(
        (card): card is VerseMemoryCard => card.type === "verse-memory",
      ),
    [cards],
  );
  const cardsById = useMemo(() => {
    const map = new Map<string, VerseMemoryCard>();
    for (const card of verseCards) map.set(card.id, card);
    return map;
  }, [verseCards]);
  const verseIdsKey = useMemo(
    () => verseCards.map((card) => card.id).join("\u0000"),
    [verseCards],
  );

  const effectiveMode =
    mode.kind === "focus" && !cardsById.has(mode.verseId) ? INITIAL_MODE : mode;

  function handleReviewAll() {
    setMode((previous) => (previous.kind === "all" ? previous : INITIAL_MODE));
  }

  function handleShuffle() {
    setMode((previous) => ({
      kind: "all",
      order: "shuffle",
      nonce: previous.kind === "all" ? previous.nonce + 1 : 0,
    }));
  }

  function handleRestoreOrder() {
    setMode((previous) => ({
      kind: "all",
      order: "in-order",
      nonce: previous.kind === "all" ? previous.nonce : 0,
    }));
  }

  function handleFocusVerse(verseId: string) {
    setMode({ kind: "focus", verseId });
  }

  if (verseCards.length === 0) {
    return <StudyDeckEmptyState />;
  }

  const focusedCard =
    effectiveMode.kind === "focus"
      ? cardsById.get(effectiveMode.verseId)
      : null;
  const mobileModeLabel =
    effectiveMode.kind === "all"
      ? effectiveMode.order === "shuffle"
        ? "Reviewing all: shuffled"
        : "Reviewing all: in order"
      : focusedCard
        ? `Focused: ${formatVerseRef(focusedCard.reference)}`
        : "Focused verse";

  const controls = (
    <StudyVerseMemoryControls
      cards={verseCards}
      mode={effectiveMode}
      onReviewAll={handleReviewAll}
      onShuffle={handleShuffle}
      onRestoreOrder={handleRestoreOrder}
      onFocusVerse={handleFocusVerse}
    />
  );

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Verse Memory
              </p>
              <p className="truncate text-sm font-medium">{mobileModeLabel}</p>
            </div>
            <Popover open={controlsOpen} onOpenChange={setControlsOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Controls
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
                <StudyVerseMemoryControls
                  cards={verseCards}
                  mode={effectiveMode}
                  onReviewAll={handleReviewAll}
                  onShuffle={handleShuffle}
                  onRestoreOrder={handleRestoreOrder}
                  onFocusVerse={handleFocusVerse}
                  onVerseSelected={() => setControlsOpen(false)}
                  className="border-0 shadow-none"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_16rem] lg:items-start">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:col-start-1">
          {controls}
        </aside>
        <main className="min-w-0 lg:col-start-2">
          {effectiveMode.kind === "focus" && focusedCard ? (
            <StudyVerseLearn key={focusedCard.id} card={focusedCard} />
          ) : (
            <StudyActivityDeck
              key={`verse-memory-${verseIdsKey}`}
              cards={verseCards}
              scopeLabel={scopeLabel}
              controlledOrder={
                effectiveMode.kind === "all" ? effectiveMode : INITIAL_MODE
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
