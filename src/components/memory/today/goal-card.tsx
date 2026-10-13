import {
  Check,
  ChevronRight,
  GraduationCap,
  Play,
  RotateCcw,
} from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import type { TodayGoal } from "@/hooks/use-today-model";
import type { StepLadderDay } from "@/lib/memory-copy";
import { memoryPanelDrawerHref } from "@/lib/memory-panel";
import { goalPanel } from "@/lib/memory-verses-drawer";
import {
  todayGoalCardModel,
  type GoalBar,
  type GoalChip,
  type GoalStep,
} from "@/lib/today-goal-card";
import { cn } from "@/lib/utils";

/**
 * One thing being memorized. The title is a stretched link that opens its
 * detail drawer, so the whole card is clickable while the one action stays a
 * separate control (no nested interactive elements).
 */
export function GoalCard({
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

  return (
    <div className="group relative flex w-full min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md has-[[data-goal-link]:focus-visible]:outline-2 has-[[data-goal-link]:focus-visible]:outline-offset-2 has-[[data-goal-link]:focus-visible]:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-snug font-semibold break-words transition-colors group-hover:text-primary">
            <InternalLink
              href={detailHref}
              data-goal-link
              className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
              {goal.title}
              <ChevronRight
                aria-hidden
                className="ml-0.5 inline size-3.5 align-[-2px] opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none"
              />
            </InternalLink>
          </h3>
          <p className="text-xs text-muted-foreground">{model.kindLabel}</p>
        </div>
        {model.chip ? <Chip chip={model.chip} /> : null}
      </div>

      {model.steps.map((step, index) => (
        <Step key={`${step.kind}-${index}`} step={step} />
      ))}

      {model.bars.map((bar) => (
        <Track key={bar.track} bar={bar} />
      ))}

      {model.action ? (
        <div className="mt-auto pt-0.5">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="relative z-10 max-sm:h-11"
          >
            <InternalLink href={model.action.href}>
              {model.action.kind === "review" ? (
                <RotateCcw aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              {model.action.label}
            </InternalLink>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ chip }: { chip: GoalChip }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        chip.tone === "today"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      {chip.tone === "done" ? <Check aria-hidden className="size-3" /> : null}
      {chip.label}
    </span>
  );
}

function Ladder({ day, active }: { day: StepLadderDay; active: boolean }) {
  return (
    <span aria-hidden className="mt-1.5 flex max-w-[180px] gap-[3px]">
      {[1, 2, 3].map((segment) => (
        <span
          key={segment}
          className={cn(
            "h-1 flex-1 rounded-sm",
            segment < day
              ? "bg-amber-500"
              : segment === day && active
                ? "bg-amber-500/40"
                : "bg-muted",
          )}
        />
      ))}
    </span>
  );
}

function Step({ step }: { step: GoalStep }) {
  switch (step.kind) {
    case "learn":
      return (
        <div className="flex items-start gap-2 text-[13px] leading-normal">
          <GraduationCap
            aria-hidden
            className="mt-[3px] size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
          />
          <div className="min-w-0">
            {step.lead ? <b className="font-semibold">{step.lead}</b> : null}{" "}
            {step.rest}
            {step.ladderDay ? <Ladder day={step.ladderDay} active /> : null}
          </div>
        </div>
      );
    case "learnCount":
      return (
        <div className="flex items-start gap-2 text-[13px] leading-normal">
          <GraduationCap
            aria-hidden
            className="mt-[3px] size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
          />
          <p className="min-w-0">{step.text}</p>
        </div>
      );
    case "review":
      return (
        <div className="flex items-start gap-2 text-[13px] leading-normal">
          <RotateCcw
            aria-hidden
            className="mt-[3px] size-3.5 shrink-0 text-sky-700 dark:text-sky-400"
          />
          <p className="min-w-0">{step.text}</p>
        </div>
      );
    case "reviews":
      return (
        <div className="flex items-start gap-2 text-[13px] leading-normal">
          <RotateCcw
            aria-hidden
            className="mt-[3px] size-3.5 shrink-0 text-sky-700 dark:text-sky-400"
          />
          <div className="min-w-0">
            <b className="font-semibold">Reviews due</b>
            <ul
              aria-label="Reviews due"
              className="mt-1.5 flex flex-wrap gap-1.5"
            >
              {step.labels.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 py-0.5 pr-2 pl-1.5 text-xs font-medium text-sky-800 dark:text-sky-200"
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  {label}
                </li>
              ))}
              {step.more > 0 ? (
                <li className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  +{step.more} more
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      );
    case "done":
      return (
        <div className="flex items-start gap-2 text-[13px] leading-normal text-emerald-700 dark:text-emerald-300">
          <Check aria-hidden className="mt-[3px] size-3.5 shrink-0" />
          <p className="min-w-0">{step.text}</p>
        </div>
      );
    case "note":
      return <p className="text-[13px] text-muted-foreground">{step.text}</p>;
  }
}

function Track({ bar }: { bar: GoalBar }) {
  const mastery = bar.track === "mastery";
  const percent = Math.round(Math.min(Math.max(bar.fraction, 0), 1) * 100);
  const ladder = bar.ladder;
  return (
    <div className="grid gap-1">
      <div
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-2 text-xs",
          mastery && "text-muted-foreground",
        )}
      >
        <span className={cn(!mastery && "font-medium")}>{bar.label}</span>
        {bar.detail ? (
          <span className="text-muted-foreground">{bar.detail}</span>
        ) : null}
      </div>
      {ladder ? (
        <div
          role="progressbar"
          aria-label={bar.ariaLabel}
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={ladder.day - 1}
          className="flex gap-[3px]"
        >
          {[1, 2, 3].map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                segment < ladder.day
                  ? "bg-primary"
                  : segment === ladder.day && ladder.active
                    ? "bg-primary/40"
                    : "bg-muted",
              )}
            />
          ))}
        </div>
      ) : (
        <div
          role="progressbar"
          aria-label={bar.ariaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className={cn(
            "overflow-hidden rounded-full bg-muted",
            mastery ? "h-1" : "h-1.5",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full",
              mastery ? "bg-emerald-500/80" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
