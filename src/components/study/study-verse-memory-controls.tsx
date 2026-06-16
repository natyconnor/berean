import { BookOpen, ListOrdered, Shuffle, Sprout, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import type { VerseMemoryCard } from "./study-card-model";

export type VerseStudyOrder = "shuffle" | "in-order";

export type VerseStudyMode =
  | { kind: "all"; order: VerseStudyOrder; nonce: number }
  | { kind: "focus"; verseId: string };

interface StudyVerseMemoryControlsProps {
  cards: VerseMemoryCard[];
  mode: VerseStudyMode;
  onReviewAll: () => void;
  onShuffle: () => void;
  onRestoreOrder: () => void;
  onFocusVerse: (verseId: string) => void;
  onVerseSelected?: () => void;
  className?: string;
}

export function StudyVerseMemoryControls({
  cards,
  mode,
  onReviewAll,
  onShuffle,
  onRestoreOrder,
  onFocusVerse,
  onVerseSelected,
  className,
}: StudyVerseMemoryControlsProps) {
  const activeVerseId = mode.kind === "focus" ? mode.verseId : null;
  const isReviewAll = mode.kind === "all";
  const canReorder = cards.length >= 2;

  function handleFocusVerse(verseId: string) {
    onFocusVerse(verseId);
    onVerseSelected?.();
  }

  function handleFocusMode() {
    const verseId = activeVerseId ?? cards[0]?.id;
    if (verseId) handleFocusVerse(verseId);
  }

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Study mode
          </p>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Study mode"
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                isReviewAll
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={onReviewAll}
              aria-pressed={isReviewAll}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Review all
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                !isReviewAll
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={handleFocusMode}
              disabled={cards.length === 0}
              aria-pressed={!isReviewAll}
            >
              <Sprout className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Learn
            </button>
          </div>
        </div>

        {isReviewAll ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Order
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Review order"
            >
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mode.order === "shuffle"
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={onShuffle}
                disabled={!canReorder}
                aria-pressed={mode.order === "shuffle"}
              >
                <Shuffle className="h-3 w-3 shrink-0" aria-hidden />
                Shuffle
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mode.order === "in-order"
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={onRestoreOrder}
                disabled={!canReorder}
                aria-pressed={mode.order === "in-order"}
              >
                <ListOrdered className="h-3 w-3 shrink-0" aria-hidden />
                In order
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Verses
            </p>
            <div className="max-h-[360px] flex flex-col gap-1.5 overflow-y-auto pr-1">
              {cards.map((card) => {
                const active = card.id === activeVerseId;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={cn(
                      "inline-flex w-full items-center rounded-full border px-2.5 py-1 text-left text-[11px] font-medium transition-colors",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => handleFocusVerse(card.id)}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="truncate">
                      {formatVerseRef(card.reference)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
