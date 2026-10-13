import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TodayGoal } from "@/hooks/use-today-model";
import { goalKey } from "@/lib/memory-verses-drawer";
import { GOAL_CARD_LIMIT } from "@/lib/today-goal-card";

import { GoalCard } from "./goal-card";

/**
 * "What you're memorizing": the first six goals (work today first), two
 * columns from 768px, and "Show all" in place when there are more.
 */
export function GoalGrid({
  goals,
  now,
  timeZone,
}: {
  goals: readonly TodayGoal[];
  now: number;
  timeZone?: string;
}) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const firstHiddenRef = useRef<HTMLLIElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  if (goals.length === 0) return null;
  const hasMore = goals.length > GOAL_CARD_LIMIT;
  const shown = expanded ? goals : goals.slice(0, GOAL_CARD_LIMIT);

  const toggle = () => {
    if (!expanded) {
      flushSync(() => setExpanded(true));
      firstHiddenRef.current
        ?.querySelector<HTMLElement>("a[href], button")
        ?.focus();
      return;
    }
    flushSync(() => setExpanded(false));
    toggleRef.current?.scrollIntoView?.({ block: "nearest" });
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-[15px] font-semibold tracking-tight">
        What you&apos;re memorizing{" "}
        <span className="font-normal text-muted-foreground tabular-nums">
          · {goals.length}
        </span>
      </h2>
      <ul id={listId} className="grid gap-3 md:grid-cols-2">
        {shown.map((goal, index) => (
          <li
            key={goalKey(goal)}
            ref={index === GOAL_CARD_LIMIT ? firstHiddenRef : undefined}
            className="flex min-w-0"
          >
            <GoalCard goal={goal} now={now} timeZone={timeZone} />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button
          ref={toggleRef}
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground max-sm:h-11"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={toggle}
        >
          {expanded ? "Show fewer" : `Show all ${goals.length}`}
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
      ) : null}
    </section>
  );
}
