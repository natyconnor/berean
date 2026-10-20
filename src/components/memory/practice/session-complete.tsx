import type { JSX } from "react";
import { Sparkles } from "lucide-react";

import { FirstMemorizedBanner } from "@/components/memory/celebrate/first-memorized-banner";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";
import { AddToPack } from "@/components/memory/packs/add-to-pack";
import type { CardReference } from "@/components/study/study-card-model";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  SESSION_COMPLETE_FOOTER,
  SESSION_COMPLETE_TITLE,
  statusLabel,
} from "@/lib/memory-copy";
import { isReviewPhase, type MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

import { ExtraPracticeLink } from "./extra-practice-link";
import { PRACTICE_STAGES, practiceChromeFor } from "./practice-stages";

export interface SessionCompleteVerse {
  id: string;
  reference: CardReference;
  learnStage: number;
  status: MemoryStatus;
  /** Moved from learning into review during this session. */
  justMemorized?: boolean;
}

interface SessionCompleteProps {
  /** Every verse the session ran, with the step each one landed on. */
  verses: ReadonlyArray<SessionCompleteVerse>;
  /** Label for the primary exit action, "Done". */
  exitLabel: string;
  onExit: () => void;
  /** Shows a ghost Extra practice beside Done. */
  extraPracticeHref?: string;
}

/**
 * End-of-queue card for a Learning run: each verse has spent today's turn, so
 * show where it landed and what it picks up on the next session.
 */
export function SessionComplete({
  verses,
  exitLabel,
  onExit,
  extraPracticeHref,
}: SessionCompleteProps): JSX.Element {
  const graduated = verses.filter((verse) => isReviewPhase(verse.status));

  return (
    <MemoryDashboardCard className="mx-auto w-full max-w-md p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {SESSION_COMPLETE_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">
          {verses.length === 1
            ? "You finished this verse's session for today."
            : `You finished today's session for all ${verses.length} verses.`}{" "}
          {graduated.length > 0
            ? `${graduated.length} moved into review.`
            : SESSION_COMPLETE_FOOTER}
        </p>
      </div>

      <FirstMemorizedBanner verses={verses} className="mt-5" />

      <SessionCompleteRows verses={verses} className="mt-6" />

      <SessionSummaryActions
        exitLabel={exitLabel}
        onExit={onExit}
        extraPracticeHref={extraPracticeHref}
        className="mt-6"
      />
    </MemoryDashboardCard>
  );
}

/**
 * Each learned verse and the step it picks up next, or "Memorized", with an
 * Add to pack shortcut.
 */
export function SessionCompleteRows({
  verses,
  className,
}: {
  verses: ReadonlyArray<SessionCompleteVerse>;
  className?: string;
}): JSX.Element {
  const now = useLiveNow();
  return (
    <ul className={cn("divide-y rounded-lg border text-left", className)}>
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
              {formatVerseRefTitle(verse.reference)}
            </p>
            <div className="-my-1 -mr-1.5 flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  chrome.text,
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", chrome.dot)}
                  aria-hidden
                />
                {reviewing
                  ? statusLabel("reviewing")
                  : `Tomorrow: ${stage.label}`}
              </span>
              <AddToPack reference={verse.reference} now={now} variant="icon" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A summary's footer: primary Done, with a ghost Extra practice beside it. */
export function SessionSummaryActions({
  exitLabel,
  onExit,
  exitVariant = "default",
  extraPracticeHref,
  className,
}: {
  exitLabel: string;
  onExit: () => void;
  /** Outline when another action (Keep reviewing) leads. */
  exitVariant?: "default" | "outline";
  extraPracticeHref?: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {extraPracticeHref ? (
        <ExtraPracticeLink href={extraPracticeHref} />
      ) : null}
      <Button
        variant={exitVariant}
        onClick={onExit}
        className="max-sm:h-11 sm:min-w-28"
      >
        {exitLabel}
      </Button>
    </div>
  );
}
