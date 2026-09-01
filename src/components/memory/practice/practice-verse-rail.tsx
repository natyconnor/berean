import { ListOrdered, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import type { MemoryStatus } from "@/lib/memory-scheduler";
import type { MemorySessionLabel } from "@/lib/memory-session";
import {
  groupSessionVersesByChapter,
  type SessionOrderItem,
} from "@/lib/memory-session-order";
import type { PracticeOrder } from "@/lib/practice-order";
import { cn } from "@/lib/utils";
import { formatBookChapter, formatVerseRef } from "@/lib/verse-ref-utils";

import type { CardReference } from "../../study/study-card-model";
import { LearningJourneyBar } from "./learning-journey-bar";
import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";

interface RailVerse extends SessionOrderItem {
  id: string;
  reference: CardReference;
  learnStage: number;
  stageReps: number;
  status: MemoryStatus;
  locked?: boolean;
  /** Overrides the reference label (a composite row names its pack). */
  label?: string;
}

interface PracticeVerseRailProps {
  sessionLabel: MemorySessionLabel;
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
  /** Lifecycle status — fills the journey bar once graduated. */
  currentStatus: MemoryStatus;
  /**
   * Word count of the active verse's text. When provided, the rep label uses
   * the length-adjusted required-rep count via {@link requiredRepsFor} so it
   * matches the card and server. Falls back to short-verse minima when absent.
   */
  currentWordCount?: number;
  /** Soft-locked: today's learning session is done for the active verse. */
  currentLocked?: boolean;
  /**
   * Whether the Shuffle / In-order toggle may appear. A composite recitation
   * is one card in passage order, so it turns reordering off entirely.
   */
  allowReorder?: boolean;
  className?: string;
}

/**
 * The Practice sidebar: a Shuffle / In-order toggle, a read-only progress
 * indicator for the active verse (current band + rep count — never a manual
 * stage selector, so the learner can't skip ahead of the schedule), and the
 * clickable verse list used to jump around the set.
 */
export function PracticeVerseRail({
  sessionLabel,
  verses,
  activeId,
  onSelectVerse,
  order,
  onOrderChange,
  shuffleNonce,
  currentLearnStage,
  currentStageReps,
  currentStatus,
  currentWordCount,
  currentLocked = false,
  allowReorder = true,
  className,
}: PracticeVerseRailProps) {
  const canReorder = allowReorder && verses.length >= 2;
  const currentChrome = practiceChromeFor(currentLearnStage, currentStatus);
  const groups = groupSessionVersesByChapter(verses);
  const showChapterHeadings = order === "in-order" && groups.length > 1;
  // A labeled row stands for a whole pack passage, not a single verse.
  const listHeading = verses.some((verse) => verse.label !== undefined)
    ? "Passage"
    : verses.length === 1
      ? "Verse"
      : "Verses";

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="space-y-4">
        {canReorder && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Order
            </p>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              role="group"
              aria-label={`${sessionLabel} order`}
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
                title="Canonical Bible order. Verses from the same chapter stay together."
              >
                <ListOrdered className="h-3.5 w-3.5 shrink-0" aria-hidden />
                In order
              </button>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {order === "in-order"
                ? "Scripture order. Verses from the same chapter stay together."
                : "Random order for this run."}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Progress
          </p>
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5",
              currentChrome.railActive,
            )}
          >
            <LearningJourneyBar
              learnStage={currentLearnStage}
              stageReps={currentStageReps}
              wordCount={currentWordCount}
              status={currentStatus}
            />
            {currentLocked ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Next session tomorrow
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {listHeading}
          </p>
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {groups.map((group) => (
                <div
                  key={`${group.book}:${group.chapter}`}
                  className="flex flex-col gap-1.5"
                >
                  {showChapterHeadings ? (
                    <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {formatBookChapter(group.book, group.chapter)}
                    </p>
                  ) : null}
                  {group.items.map((verse) => {
                    const active = verse.id === activeId;
                    const stage =
                      PRACTICE_STAGES[verse.learnStage] ?? PRACTICE_STAGES[0];
                    const chrome = practiceChromeFor(
                      verse.learnStage,
                      verse.status,
                    );
                    const locked = verse.locked === true;
                    const label =
                      verse.label ?? formatVerseRef(verse.reference);
                    return (
                      <motion.button
                        layout
                        key={verse.id}
                        type="button"
                        className={cn(
                          "inline-flex w-full items-center gap-2 rounded-full border px-2.5 py-1 text-left text-[11px] font-medium transition-colors",
                          locked && "opacity-60",
                          active
                            ? chrome.railActive
                            : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                        onClick={() => onSelectVerse(verse.id)}
                        aria-current={active ? "true" : undefined}
                        aria-label={`${label} (${stage.label} band${locked ? ", done for today" : ""})`}
                        title={`${label} · ${stage.label}${locked ? " · Tomorrow" : ""}`}
                        transition={{
                          layout: { duration: 0.28, ease: "easeOut" },
                        }}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full ring-1 ring-background/80",
                            chrome.dot,
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{label}</span>
                        {locked ? (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            Done
                          </span>
                        ) : null}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
