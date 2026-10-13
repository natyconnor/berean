import { type JSX, useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import type {
  TodayQueueGroup,
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

/**
 * Everything in today's session, grouped as it runs: Passages, Verses to learn,
 * Reviews. Each item is done, underway, or still to come. Informational
 * only; the session moves through it in order. Collapsed behind a toggle on
 * small screens so the work stays in view.
 */
export function TodayQueueRail({
  groups,
  counts,
  className,
}: {
  groups: readonly TodayQueueGroup[];
  counts: TodaySessionCounts;
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
                  className={cn(
                    "flex w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    item.state === "current"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background text-muted-foreground",
                  )}
                  title={item.label}
                >
                  <StateMark state={item.state} />
                  <span className="truncate">{item.label}</span>
                  <span className="sr-only">, {STATE_TEXT[item.state]}</span>
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
 */
export function TodayQueueOverview({
  groups,
  className,
}: {
  groups: readonly TodayQueueGroup[];
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
        {groups.map((group) => (
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
            <StateMark state={group.state} />
            {group.heading}
            {group.state === "current" ? (
              <span className="text-muted-foreground">(now)</span>
            ) : group.state === "upcoming" ? (
              <span className="tabular-nums">{group.total}</span>
            ) : (
              <span className="sr-only">, done</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
