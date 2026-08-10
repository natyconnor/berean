import type { JSX } from "react";
import { Sparkles } from "lucide-react";

import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import type { CardReference } from "@/components/study/study-card-model";
import { Button } from "@/components/ui/button";
import { isReviewPhase, type MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";

export interface SessionCompleteVerse {
  id: string;
  reference: CardReference;
  learnStage: number;
  status: MemoryStatus;
}

interface SessionCompleteProps {
  /** Every verse the session ran, with the band each one landed on. */
  verses: ReadonlyArray<SessionCompleteVerse>;
  /** Label for the exit action, e.g. "Back to Memory" or "Back to Pack". */
  exitLabel: string;
  onExit: () => void;
}

/**
 * End-of-queue card for a Learning run: each verse has spent today's turn, so
 * show where it landed and what it picks up on the next session.
 */
export function SessionComplete({
  verses,
  exitLabel,
  onExit,
}: SessionCompleteProps): JSX.Element {
  const graduated = verses.filter((verse) => isReviewPhase(verse.status));

  return (
    <MemoryDashboardCard className="mx-auto w-full max-w-md p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Today&apos;s learning is done
        </h2>
        <p className="text-sm text-muted-foreground">
          {verses.length === 1
            ? "You finished this verse's session for today."
            : `You finished today's session for all ${verses.length} verses.`}{" "}
          {graduated.length > 0
            ? `${graduated.length} moved into review.`
            : "Come back tomorrow for the next band."}
        </p>
      </div>

      <ul className="mt-6 divide-y rounded-lg border text-left">
        {verses.map((verse) => {
          const stage = PRACTICE_STAGES[verse.learnStage] ?? PRACTICE_STAGES[0];
          const chrome = practiceChromeFor(verse.learnStage, verse.status);
          const reviewing = isReviewPhase(verse.status);
          return (
            <li
              key={verse.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <p className="min-w-0 truncate text-sm font-medium">
                {formatVerseRef(verse.reference)}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
                  chrome.text,
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", chrome.dot)}
                  aria-hidden
                />
                {reviewing ? "In review" : `${stage.label} tomorrow`}
              </span>
            </li>
          );
        })}
      </ul>

      <Button className="mt-6 w-full" onClick={onExit}>
        {exitLabel}
      </Button>
    </MemoryDashboardCard>
  );
}
