import { ListOrdered, Shuffle } from "lucide-react";

import type { PracticeOrder } from "@/lib/practice-order";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import type { CardReference } from "../../study/study-card-model";
import { PRACTICE_STAGES } from "./practice-stages";

interface RailVerse {
  id: string;
  reference: CardReference;
}

interface PracticeVerseRailProps {
  verses: ReadonlyArray<RailVerse>;
  activeId: string | null;
  onSelectVerse: (id: string) => void;
  order: PracticeOrder;
  onOrderChange: (order: PracticeOrder) => void;
  stageIndex: number;
  onStageChange: (stageIndex: number) => void;
  className?: string;
}

/**
 * The Practice sidebar: a Shuffle / In-order toggle, a manual stage selector
 * (Full · Letters · Blanks · Hidden), and the clickable verse list used to jump
 * around the set. Modeled on `StudyVerseMemoryControls`' verse list.
 */
export function PracticeVerseRail({
  verses,
  activeId,
  onSelectVerse,
  order,
  onOrderChange,
  stageIndex,
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
              <Shuffle className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
            {PRACTICE_STAGES.map((item, index) => (
              <button
                key={item.stage}
                type="button"
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  index === stageIndex
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onStageChange(index)}
                aria-pressed={index === stageIndex}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Verses
          </p>
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
            {verses.map((verse) => {
              const active = verse.id === activeId;
              return (
                <button
                  key={verse.id}
                  type="button"
                  className={cn(
                    "inline-flex w-full items-center rounded-full border px-2.5 py-1 text-left text-[11px] font-medium transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => onSelectVerse(verse.id)}
                  aria-current={active ? "true" : undefined}
                >
                  <span className="truncate">
                    {formatVerseRef(verse.reference)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
