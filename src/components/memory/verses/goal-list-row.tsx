import { Dumbbell, GraduationCap, Play, RotateCcw } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { MemoryListRow } from "@/components/memory/memory-surface";
import { GoalKindMark } from "@/components/memory/today/goal-kind-icon";
import { Button } from "@/components/ui/button";
import { withReturn } from "@/lib/memory-return";
import {
  memoryPackSessionHref,
  memoryTodaySessionHref,
} from "@/lib/memory-session-path";
import { goalStatusLine } from "@/lib/memory-verses-drawer";
import {
  goalRowAction,
  goalStatusSegments,
  type GoalRowAction,
  type GoalRowGoal,
} from "@/lib/your-verses-goals";

import { StatusMixBar } from "./status-mix-bar";

const ACTION_ICON: Record<GoalRowAction["label"], typeof Play> = {
  Start: GraduationCap,
  Continue: Play,
  Review: RotateCcw,
  Practice: Dumbbell,
};

/**
 * A passage or pack on one line: its kind, title, where it stands, its mix of
 * statuses, and one session, today's or Practice. The title is a stretched
 * link to its detail; the session stays a separate control.
 */
export function GoalListRow({
  goal,
  now,
  timeZone,
  detailHref,
  returnTo,
}: {
  goal: GoalRowGoal;
  now: number;
  timeZone?: string;
  detailHref: string;
  /** Where the session comes back to. */
  returnTo: string;
}) {
  const action = goalRowAction(goal, now, timeZone);
  const Icon = action ? ACTION_ICON[action.label] : null;
  const sessionHref = action
    ? withReturn(
        action.session === "today"
          ? memoryTodaySessionHref({ packId: goal.packId })
          : memoryPackSessionHref(action.session, goal.packId),
        returnTo,
      )
    : null;

  return (
    <MemoryListRow className="relative flex min-h-14 min-w-0 items-center gap-3 px-3 py-2 has-[[data-goal-link]:focus-visible]:outline-2 has-[[data-goal-link]:focus-visible]:outline-offset-2 has-[[data-goal-link]:focus-visible]:outline-ring">
      <GoalKindMark kind={goal.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <InternalLink
            href={detailHref}
            data-goal-link
            className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
          >
            {goal.title}
          </InternalLink>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {goalStatusLine(goal, now, timeZone)}
        </p>
      </div>
      <StatusMixBar
        segments={goalStatusSegments(goal)}
        className="w-14 shrink-0 max-sm:hidden"
      />
      {action && Icon && sessionHref ? (
        <Button
          asChild
          size="xs"
          variant={action.dueToday ? "outline" : "ghost"}
          className="relative z-10 shrink-0 max-sm:h-11 max-sm:px-3"
        >
          <InternalLink
            href={sessionHref}
            aria-label={`${action.label} ${goal.title}`}
          >
            <Icon aria-hidden />
            {action.label}
          </InternalLink>
        </Button>
      ) : null}
    </MemoryListRow>
  );
}
