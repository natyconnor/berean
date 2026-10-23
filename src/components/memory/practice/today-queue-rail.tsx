import { type JSX, type ReactNode, useId, useState } from "react";
import { Check, ChevronDown, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { PracticeOrder } from "@/lib/practice-order";
import { cn } from "@/lib/utils";

const headingClassName =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

const STATE_TEXT: Record<TodayQueueState, string> = {
  done: "done",
  current: "now",
  upcoming: "up next",
};

const DONE_FOR_TODAY_LABEL = "Done for today";
const SHUFFLE_VERSES_LABEL = "Shuffle verses";
const PUT_VERSES_IN_ORDER_LABEL = "Put verses in order";

function canShuffleGroups(groups: readonly TodayQueueGroup[]): boolean {
  return groups.some(
    (group) =>
      group.kind !== "passage" &&
      group.items.filter((item) => item.state === "upcoming").length >= 2,
  );
}

function QueueShuffleToggle({
  order,
  onToggle,
}: {
  order: PracticeOrder;
  onToggle: () => void;
}): JSX.Element {
  const shuffled = order === "shuffle";
  const tooltip = shuffled ? PUT_VERSES_IN_ORDER_LABEL : SHUFFLE_VERSES_LABEL;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={SHUFFLE_VERSES_LABEL}
          aria-pressed={shuffled}
          onClick={onToggle}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            shuffled && "bg-accent text-foreground",
          )}
        >
          <Shuffle className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

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
  open,
  onOpenChange,
  order = "in-order",
  onToggleOrder,
}: {
  groups: readonly TodayQueueGroup[];
  counts: TodaySessionCounts;
  onSelect?: (item: TodayQueueItem) => void;
  className?: string;
  /** Mobile list. Lifted so it survives item changes. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  order?: PracticeOrder;
  onToggleOrder?: () => void;
}): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const expanded = open ?? uncontrolledOpen;
  const setExpanded = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setUncontrolledOpen(next);
  };
  const selectItem = onSelect
    ? (item: TodayQueueItem) => {
        onSelect(item);
        setExpanded(false);
      }
    : undefined;
  const listId = useId();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className={headingClassName}>
          Today&apos;s queue
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {doneLine(counts)}
          </span>
          {onToggleOrder && canShuffleGroups(groups) ? (
            <QueueShuffleToggle order={order} onToggle={onToggleOrder} />
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground md:hidden"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide the queue" : "Show the queue"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={listId}
        className={cn("mt-3 space-y-4", !expanded && "max-md:hidden")}
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
                  <QueueItem item={item} onSelect={selectItem} />
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
