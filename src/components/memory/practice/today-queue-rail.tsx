import { type JSX, type ReactNode, useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  TodayQueueGroup,
  TodayQueueItem,
  TodayQueueState,
  TodaySessionCounts,
} from "@/lib/memory-today-session";
import { cn } from "@/lib/utils";

const headingClassName =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

const STATE_TEXT: Record<TodayQueueState, string> = {
  done: "done",
  current: "now",
  upcoming: "up next",
};

const DONE_FOR_TODAY_LABEL = "Done for today";

function StateMark({ state }: { state: TodayQueueState }): JSX.Element {
  if (state === "done") {
    return (
      <Check
        className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "mx-0.5 h-2 w-2 shrink-0 rounded-full",
        state === "current"
          ? "bg-primary"
          : "border border-muted-foreground/50 bg-transparent",
      )}
    />
  );
}

function doneLine(counts: TodaySessionCounts): string {
  return `${counts.done} of ${counts.total} done`;
}

/** "Go to Psalm 3", or "Go back to Genesis 1" for a finished passage. */
function goToLabel(item: TodayQueueItem): string {
  return `${item.state === "done" ? "Go back to" : "Go to"} ${item.label}`;
}

function QueueItem({
  item,
  onSelect,
}: {
  item: TodayQueueItem;
  onSelect?: (item: TodayQueueItem) => void;
}): JSX.Element {
  const pillClassName = cn(
    "flex w-full items-center gap-2 rounded-full border px-2.5 py-1 text-left text-[11px] font-medium",
    item.state === "current"
      ? "border-primary/40 bg-primary/10 text-foreground"
      : "border-border/60 bg-background text-muted-foreground",
  );
  const body: ReactNode = (
    <>
      <StateMark state={item.state} />
      <span className="truncate">{item.label}</span>
      <span className="sr-only">, {STATE_TEXT[item.state]}</span>
    </>
  );

  if (!onSelect || item.state === "current") {
    return (
      <div className={pillClassName} title={item.label}>
        {body}
      </div>
    );
  }
  if (item.openable) {
    return (
      <button
        type="button"
        className={cn(
          pillClassName,
          "transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
        title={item.label}
        aria-label={goToLabel(item)}
        onClick={() => onSelect(item)}
      >
        {body}
      </button>
    );
  }
  // Finished with nothing left today: still focusable so the reason is
  // reachable, but it opens nothing.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled="true"
          aria-label={`${item.label}, ${DONE_FOR_TODAY_LABEL.toLowerCase()}`}
          className={cn(
            pillClassName,
            "cursor-default opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          {body}
        </button>
      </TooltipTrigger>
      <TooltipContent>{DONE_FOR_TODAY_LABEL}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Everything in today's session, grouped as it runs: Passages, Verses to learn,
 * Reviews. Each item is done, underway, or still to come. With `onSelect`,
 * choosing an item jumps there; finished items with nothing left today stay
 * put. Collapsed behind a toggle on small screens so the work stays in view.
 */
export function TodayQueueRail({
  groups,
  counts,
  onSelect,
  className,
}: {
  groups: readonly TodayQueueGroup[];
  counts: TodaySessionCounts;
  onSelect?: (item: TodayQueueItem) => void;
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={headingId} className={headingClassName}>
          Today&apos;s queue
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {doneLine(counts)}
        </span>
      </div>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground md:hidden"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide the queue" : "Show the queue"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={listId}
        className={cn("mt-3 space-y-4", !open && "max-md:hidden")}
      >
        {groups.map((group) => (
          <div key={group.kind} className="space-y-2">
            <p className={headingClassName}>
              {group.heading}
              <span className="ml-1.5 font-medium tracking-normal normal-case tabular-nums">
                {group.total}
              </span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  data-state={item.state}
                  aria-current={item.state === "current" ? "step" : undefined}
                >
                  <QueueItem item={item} onSelect={onSelect} />
                </li>
              ))}
              {group.moreCount > 0 ? (
                <li className="px-2.5 text-[11px] text-muted-foreground">
                  +{group.moreCount} more
                </li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * One-line view of today's parts above a verse board's own rail, so the
 * whole day stays in sight: "Passages ✓ · Verses to learn (now) · Reviews 5".
 * With `onSelect`, a part with something left to open jumps there.
 */
export function TodayQueueOverview({
  groups,
  onSelect,
  className,
}: {
  groups: readonly TodayQueueGroup[];
  onSelect?: (group: TodayQueueGroup) => void;
  className?: string;
}): JSX.Element {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border bg-card px-4 py-3 shadow-sm", className)}
    >
      <h2 id={headingId} className={headingClassName}>
        Today
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
        {groups.map((group) => {
          const content = (
            <>
              <StateMark state={group.state} />
              {group.heading}
              {group.state === "current" ? (
                <span className="text-muted-foreground">(now)</span>
              ) : group.state === "upcoming" ? (
                <span className="tabular-nums">{group.total - group.done}</span>
              ) : (
                <span className="sr-only">, done</span>
              )}
            </>
          );
          return (
            <li
              key={group.kind}
              data-state={group.state}
              aria-current={group.state === "current" ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                group.state === "current"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {onSelect && group.target !== null ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Go to ${group.heading}`}
                  onClick={() => onSelect(group)}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
