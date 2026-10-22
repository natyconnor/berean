import type { ReactNode } from "react";
import { useQuery } from "convex-helpers/react/cache";
import {
  Clock3,
  Dumbbell,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import {
  learnEmptyCopy,
  practiceEmptyCopy,
  reviewEmptyCopy,
  soonestLearningUnlock,
  soonestReviewAt,
  type EmptyStateCopy,
  type ScheduledVerse,
} from "@/lib/memory-empty-states";
import { isMemoryHomeHref, MEMORY_HOME } from "@/lib/memory-exit";
import { cn } from "@/lib/utils";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

const ACTION_CLASS = "max-sm:h-11";

interface ExitProps {
  onExit: () => void;
  backLabel: string;
  exitHref: string;
}

function SessionEmptyState({
  icon: Icon,
  muted = false,
  copy,
  children,
}: {
  icon: LucideIcon;
  muted?: boolean;
  copy: EmptyStateCopy;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          muted ? "bg-muted" : "bg-primary/10",
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6",
            muted ? "text-muted-foreground" : "text-primary",
          )}
          aria-hidden
        />
      </div>
      <div className="max-w-sm space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        {copy.body ? (
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {children}
      </div>
    </div>
  );
}

function EmptyStateLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Back to where the session came from. When that is not Memory (the reader,
 * a pack), a link to Memory sits beside it so a finished side trip never
 * strands someone outside the dashboard.
 */
function ExitActions({
  onExit,
  backLabel,
  exitHref,
  memoryLink = true,
}: ExitProps & { memoryLink?: boolean }) {
  return (
    <>
      <Button variant="outline" className={ACTION_CLASS} onClick={onExit}>
        {backLabel}
      </Button>
      {memoryLink && !isMemoryHomeHref(exitHref) ? (
        <Button asChild variant="ghost" className={ACTION_CLASS}>
          <InternalLink href={MEMORY_HOME}>Go to Memory</InternalLink>
        </Button>
      ) : null}
    </>
  );
}

function useInMemorySchedules(): ScheduledVerse[] | undefined {
  const items = useQuery(api.verseMemory.listInMemory, {});
  return items?.map((item) => item.memory);
}

/** Review with nothing due: when the next review is. */
export function ReviewEmptyState({
  now,
  onExit,
  backLabel,
  exitHref,
}: ExitProps & { now: number }) {
  const verses = useInMemorySchedules();
  if (verses === undefined) return <EmptyStateLoading />;

  const copy = reviewEmptyCopy(
    soonestReviewAt(verses, now),
    now,
    getViewerTimeZone(),
  );
  return (
    <SessionEmptyState icon={Sparkles} copy={copy}>
      <ExitActions onExit={onExit} backLabel={backLabel} exitHref={exitHref} />
    </SessionEmptyState>
  );
}

/** Learn with nothing open: what unlocks next among `verses`, else start something new. */
export function LearnEmptyState({
  verses,
  now,
  onExit,
  backLabel,
  exitHref,
}: ExitProps & { verses: readonly ScheduledVerse[]; now: number }) {
  const copy = learnEmptyCopy(
    soonestLearningUnlock(verses, now),
    now,
    getViewerTimeZone(),
  );
  return (
    <SessionEmptyState icon={Clock3} muted copy={copy}>
      {copy.startSomethingNew ? (
        <Button asChild className={ACTION_CLASS}>
          <InternalLink href={MEMORY_HOME}>Start something new</InternalLink>
        </Button>
      ) : null}
      <ExitActions
        onExit={onExit}
        backLabel={backLabel}
        exitHref={exitHref}
        memoryLink={!copy.startSomethingNew}
      />
    </SessionEmptyState>
  );
}

/** {@link LearnEmptyState} over every verse in Memory. */
export function AllLearnEmptyState({
  now,
  onExit,
  backLabel,
  exitHref,
}: ExitProps & { now: number }) {
  const verses = useInMemorySchedules();
  if (verses === undefined) return <EmptyStateLoading />;
  return (
    <LearnEmptyState
      verses={verses}
      now={now}
      onExit={onExit}
      backLabel={backLabel}
      exitHref={exitHref}
    />
  );
}

/** Practice before anything is memorized; `scopeLabel` names one verse. */
export function PracticeEmptyState({
  scopeLabel,
  onExit,
  backLabel,
  exitHref,
}: ExitProps & { scopeLabel?: string }) {
  return (
    <SessionEmptyState
      icon={Dumbbell}
      muted
      copy={practiceEmptyCopy(scopeLabel)}
    >
      <ExitActions onExit={onExit} backLabel={backLabel} exitHref={exitHref} />
    </SessionEmptyState>
  );
}
