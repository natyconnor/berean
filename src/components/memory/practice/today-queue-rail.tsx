import { type JSX, type ReactNode, useId, useState } from "react";
import { Check, ChevronDown, ListOrdered, Shuffle } from "lucide-react";

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

const groupNameClassName =
  "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

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

function firstUnfinished(group: TodayQueueGroup): TodayQueueItem | undefined {
  return group.items.find((item) => item.state !== "done");
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

function OrderSwitch({
  order,
  onOrderChange,
}: {
  order: PracticeOrder;
  onOrderChange: (order: PracticeOrder) => void;
}): JSX.Element {
  return (
    <div
      className="inline-flex items-center rounded-md border bg-background p-0.5"
      role="radiogroup"
      aria-label="Order"
    >
      {(
        [
          ["in-order", "In order", ListOrdered],
          ["shuffle", "Shuffle", Shuffle],
        ] as const
      ).map(([value, label, Icon]) => {
        const selected = order === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-xs"
                variant={selected ? "secondary" : "ghost"}
                role="radio"
                aria-checked={selected}
                aria-label={label}
                onClick={() => onOrderChange(value)}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
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
  order = "in-order",
  onOrderChange,
  open: openProp,
  onOpenChange,
  className,
}: {
  groups: readonly TodayQueueGroup[];
  counts: TodaySessionCounts;
  onSelect?: (item: TodayQueueItem) => void;
  order?: PracticeOrder;
  onOrderChange?: (order: PracticeOrder) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const listId = useId();
  const headingId = useId();

  const selectItem = (item: TodayQueueItem) => {
    onSelect?.(item);
    setOpen(false);
  };

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
        onClick={() => setOpen(!open)}
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
      <div id={listId} className="mt-3 flex flex-col gap-1.5">
        {groups.map((group) => {
          const current = group.state === "current";
          const complete = group.done === group.total && group.total > 0;
          const unfinished = group.total - group.done;
          const showSwitch =
            current &&
            group.kind !== "passage" &&
            unfinished >= 2 &&
            onOrderChange !== undefined;
          const jumpTo = firstUnfinished(group);
          return (
            <div
              key={group.kind}
              data-group={group.kind}
              data-state={group.state}
              data-current={current ? "true" : undefined}
              className={cn(
                "relative rounded-[10px] px-2 pt-0.5 pb-1.5 -mx-1.5",
                current && "bg-primary/[0.06]",
              )}
            >
              {current ? (
                <span
                  aria-hidden
                  className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-sm bg-primary"
                />
              ) : null}
              <div className="flex h-[30px] items-center gap-1.5">
                {jumpTo && onSelect ? (
                  <button
                    type="button"
                    className={cn(
                      groupNameClassName,
                      "rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      current && "text-foreground",
                    )}
                    aria-label={`Go to ${group.heading}`}
                    onClick={() => selectItem(jumpTo)}
                  >
                    {group.heading}
                  </button>
                ) : (
                  <span
                    className={cn(
                      groupNameClassName,
                      current && "text-foreground",
                    )}
                  >
                    {group.heading}
                  </span>
                )}
                {complete ? (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums text-muted-foreground",
                    current && "text-foreground/80",
                  )}
                >
                  {group.done} of {group.total}
                </span>
                <span className="flex-1" />
                {showSwitch ? (
                  <OrderSwitch order={order} onOrderChange={onOrderChange} />
                ) : null}
              </div>
              <ul
                className={cn(
                  "mt-1.5 flex flex-col gap-1.5",
                  !open && "max-md:hidden",
                )}
              >
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    data-state={item.state}
                    aria-current={item.state === "current" ? "step" : undefined}
                  >
                    <QueueItem item={item} onSelect={onSelect && selectItem} />
                  </li>
                ))}
                {group.moreCount > 0 ? (
                  <li className="px-2.5 text-[11px] text-muted-foreground">
                    +{group.moreCount} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
