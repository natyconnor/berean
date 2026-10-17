import { Check, ChevronRight, Play, RotateCcw } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import type { TodayGoal } from "@/hooks/use-today-model";
import { memoryPanelDrawerHref } from "@/lib/memory-panel";
import { goalPanel } from "@/lib/memory-verses-drawer";
import { GOAL_KIND_NAME, todayGoalCardModel } from "@/lib/today-goal-card";

import { GoalKindMark } from "./goal-kind-icon";

/**
 * A goal on one line, under the full cards: its kind, title, today's step,
 * and its one action. Like a card, the title is a stretched link to the
 * drawer and the action stays a separate control.
 */
export function GoalRow({
  goal,
  now,
  timeZone,
}: {
  goal: TodayGoal;
  now: number;
  timeZone?: string;
}) {
  const model = todayGoalCardModel(goal, now, timeZone);
  const detailHref = memoryPanelDrawerHref(goalPanel(goal));
  const line = model.summary
    ? `${GOAL_KIND_NAME[goal.kind]} · ${model.summary}`
    : model.kindLabel;

  return (
    <div className="group relative flex min-h-14 min-w-0 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/60 has-[[data-goal-link]:focus-visible]:outline-2 has-[[data-goal-link]:focus-visible]:-outline-offset-2 has-[[data-goal-link]:focus-visible]:outline-ring">
      <GoalKindMark kind={goal.kind} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
          <InternalLink
            href={detailHref}
            data-goal-link
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {goal.title}
          </InternalLink>
        </h3>
        <p className="truncate text-xs text-muted-foreground">{line}</p>
      </div>
      {model.action ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="relative z-10 shrink-0 max-sm:h-11"
        >
          <InternalLink
            href={model.action.href}
            aria-label={model.action.label}
          >
            {model.action.kind === "review" ? (
              <RotateCcw aria-hidden />
            ) : (
              <Play aria-hidden />
            )}
            {model.action.shortLabel}
          </InternalLink>
        </Button>
      ) : model.chip ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Check aria-hidden className="size-3.5" />
          {model.chip.label}
        </span>
      ) : (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
    </div>
  );
}
