import { ListOrdered, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import type { PracticeOrder } from "@/lib/practice-order";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import type { CardReference } from "../../study/study-card-model";
import { LearningJourneyBar } from "./learning-journey-bar";
import { PRACTICE_STAGES } from "./practice-stages";

interface RailVerse {
  id: string;
  reference: CardReference;
  learnStage: number;
  stageReps: number;
}

interface PracticeVerseRailProps {
  verses: ReadonlyArray<RailVerse>;
  activeId: string | null;
  onSelectVerse: (id: string) => void;
  order: PracticeOrder;
  onOrderChange: (order: PracticeOrder) => void;
  shuffleNonce: number;
  /** The active verse's live band (0..3) driven by the server schedule. */
  currentLearnStage: number;
  /** The active verse's live reps banked on the current band. */
  currentStageReps: number;
  /**
   * Word count of the active verse's text. When provided, the rep label uses
   * the length-adjusted required-rep count via {@link requiredRepsFor} so it
   * matches the card and server. Falls back to short-verse minima when absent.
   */
  currentWordCount?: number;
  className?: string;
}

/**
 * The Practice sidebar: a Shuffle / In-order toggle, a read-only progress
 * indicator for the active verse (current band + rep count — never a manual
 * stage selector, so the learner can't skip ahead of the schedule), and the
 * clickable verse list used to jump around the set.
 */
export function PracticeVerseRail({
  verses,
  activeId,
  onSelectVerse,
  order,
  onOrderChange,
  shuffleNonce,
  currentLearnStage,
  currentStageReps,
  currentWordCount,
  className,
}: PracticeVerseRailProps) {
  const canReorder = verses.length >= 2;
  const currentStage = PRACTICE_STAGES[currentLearnStage] ?? PRACTICE_STAGES[0];

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Order
          </p>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Practice order"
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                order === "shuffle"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onOrderChange("shuffle")}
              disabled={!canReorder}
              aria-pressed={order === "shuffle"}
            >
              <motion.span
                key={shuffleNonce}
                aria-hidden
                initial={{ rotate: 0 }}
                animate={{ rotate: order === "shuffle" ? 360 : 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="inline-flex"
              >
                <Shuffle className="h-3.5 w-3.5 shrink-0" />
              </motion.span>
              Shuffle
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                order === "in-order"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onOrderChange("in-order")}
              aria-pressed={order === "in-order"}
            >
              <ListOrdered className="h-3.5 w-3.5 shrink-0" aria-hidden />
              In order
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Progress
          </p>
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5",
              currentStage.color.railActive,
            )}
          >
            <LearningJourneyBar
              learnStage={currentLearnStage}
              stageReps={currentStageReps}
              wordCount={currentWordCount}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Verses
          </p>
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {verses.map((verse) => {
                const active = verse.id === activeId;
                const stage =
                  PRACTICE_STAGES[verse.learnStage] ?? PRACTICE_STAGES[0];
                return (
                  <motion.button
                    layout
                    key={verse.id}
                    type="button"
                    className={cn(
                      "inline-flex w-full items-center gap-2 rounded-full border px-2.5 py-1 text-left text-[11px] font-medium transition-colors",
                      active
                        ? stage.color.railActive
                        : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => onSelectVerse(verse.id)}
                    aria-current={active ? "true" : undefined}
                    aria-label={`${formatVerseRef(verse.reference)} (${stage.label} band)`}
                    title={`${formatVerseRef(verse.reference)} · ${stage.label}`}
                    transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full ring-1 ring-background/80",
                        stage.color.dot,
                      )}
                      aria-hidden
                    />
                    <span className="truncate">
                      {formatVerseRef(verse.reference)}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
