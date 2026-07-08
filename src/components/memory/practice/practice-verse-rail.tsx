import { ListOrdered, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import type { PracticeOrder } from "@/lib/practice-order";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import type { CardReference } from "../../study/study-card-model";
import { PRACTICE_STAGES } from "./practice-stages";

interface RailVerse {
  id: string;
  reference: CardReference;
  learnStage: number;
}

interface PracticeVerseRailProps {
  verses: ReadonlyArray<RailVerse>;
  activeId: string | null;
  onSelectVerse: (id: string) => void;
  order: PracticeOrder;
  onOrderChange: (order: PracticeOrder) => void;
  shuffleNonce: number;
  stageIndex: number;
  /** Highest selectable rung: the verse's achieved level (no skipping ahead). */
  maxStageIndex: number;
  onStageChange: (stageIndex: number) => void;
  className?: string;
}

/**
 * The Practice sidebar: a Shuffle / In-order toggle, a manual stage selector
 * (Full · Letters · Blanks · Hidden), and the clickable verse list used to jump
 * around the set.
 */
export function PracticeVerseRail({
  verses,
  activeId,
  onSelectVerse,
  order,
  onOrderChange,
  shuffleNonce,
  stageIndex,
  maxStageIndex,
  onStageChange,
  className,
}: PracticeVerseRailProps) {
  const canReorder = verses.length >= 2;

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
            Stage
          </p>
          <div
            className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Practice stage"
          >
            {PRACTICE_STAGES.map((item, index) => {
              const selected = index === stageIndex;
              const locked = index > maxStageIndex;
              return (
                <button
                  key={item.stage}
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? item.color.selectedButton
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    locked &&
                      "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
                  )}
                  onClick={() => onStageChange(index)}
                  disabled={locked}
                  aria-pressed={selected}
                  title={
                    locked
                      ? `Reach ${item.label} through review before practicing it`
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      item.color.dot,
                    )}
                    aria-hidden
                  />
                  {item.label}
                </button>
              );
            })}
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
                    aria-label={`${formatVerseRef(verse.reference)} (${stage.label} stage)`}
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
