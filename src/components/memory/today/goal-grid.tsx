import { useId } from "react";

import type { TodayGoal } from "@/hooks/use-today-model";
import { goalKey } from "@/lib/memory-verses-drawer";
import type { GoalLayout } from "@/lib/today-goal-layout";
import { cn } from "@/lib/utils";

import { GoalCard } from "./goal-card";
import { GoalRow } from "./goal-row";

/** Rows of full cards in the grid before the rest become rows. */
const GRID_CARD_ROWS = 2;

/** "What you're memorizing", work today first, laid out per `layout`. */
export function GoalGrid({
  goals,
  now,
  timeZone,
  layout,
}: {
  goals: readonly TodayGoal[];
  now: number;
  timeZone?: string;
  layout: GoalLayout;
}) {
  const headingId = useId();
  if (goals.length === 0) return null;

  const card = (goal: TodayGoal) => (
    <GoalCard goal={goal} now={now} timeZone={timeZone} />
  );
  const columns = layout.kind === "grid" ? layout.columns : 2;
  const cardCount =
    layout.kind === "grid" ? columns * GRID_CARD_ROWS : goals.length;
  const rows = goals.slice(cardCount);
  const rowColumns = Math.min(columns, rows.length);

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-[15px] font-semibold tracking-tight">
        What you&apos;re memorizing{" "}
        <span className="font-normal text-muted-foreground tabular-nums">
          · {goals.length}
        </span>
      </h2>
      {layout.kind === "shelf" ? (
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:thin] sm:-mx-5 sm:scroll-px-5 sm:px-5">
          {goals.map((goal) => (
            <li
              key={goalKey(goal)}
              className="flex w-[min(20rem,calc(100%-2.5rem))] shrink-0 snap-start"
            >
              {card(goal)}
            </li>
          ))}
        </ul>
      ) : (
        <ul
          className={cn(
            "grid gap-3",
            columns === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {goals.slice(0, cardCount).map((goal) => (
            <li key={goalKey(goal)} className="flex min-w-0">
              {card(goal)}
            </li>
          ))}
        </ul>
      )}
      {layout.kind === "grid" && rows.length > 0 ? (
        <ul
          aria-label="More you're memorizing"
          className={cn(
            "grid overflow-hidden rounded-xl border bg-card shadow-sm",
            rowColumns === 3
              ? "grid-cols-3"
              : rowColumns === 2
                ? "grid-cols-2"
                : "grid-cols-1",
          )}
        >
          {rows.map((goal, index) => (
            <li
              key={goalKey(goal)}
              className={cn(
                "min-w-0",
                index >= rowColumns && "border-t",
                index % rowColumns !== 0 && "border-l",
              )}
            >
              <GoalRow goal={goal} now={now} timeZone={timeZone} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
