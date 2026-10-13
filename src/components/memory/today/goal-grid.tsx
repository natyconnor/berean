import { useId } from "react";

import type { TodayGoal } from "@/hooks/use-today-model";
import { goalKey } from "@/lib/memory-verses-drawer";
import { GOAL_CARD_LIMIT } from "@/lib/today-goal-card";

import { GoalCard } from "./goal-card";

/** "What you're memorizing": up to six goals, two columns from 768px. */
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
  const shown = goals.slice(0, GOAL_CARD_LIMIT);
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-[15px] font-semibold tracking-tight">
        What you&apos;re memorizing
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((goal) => (
          <li key={goalKey(goal)} className="flex min-w-0">
            <GoalCard goal={goal} now={now} timeZone={timeZone} />
          </li>
        ))}
      </ul>
    </section>
  );
}
