import type { HTMLAttributes } from "react";
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
import { memoryPanelDrawerHref } from "@/lib/memory-panel";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { goalPanel } from "@/lib/memory-verses-drawer";
import {
  todayGoalCardModel,
  type GoalBar,
  type GoalChip,
  type GoalSignature,
  type GoalStep,
} from "@/lib/today-goal-card";
import { cn } from "@/lib/utils";

import { GoalKindChip } from "./goal-kind-icon";

/** Past this many verses a passage's ruler is one continuous bar. */
const RULER_TICK_LIMIT = 48;
/** Past this many verses a pack's dots become one stacked bar. */
const PACK_DOT_LIMIT = 24;

function toPercent(fraction: number): number {
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
}

/**
 * One thing being memorized. The title is a stretched link that opens its
 * detail drawer, so the whole card is clickable while the one action stays a
 * separate control (no nested interactive elements). Kinds share one card and
 * differ by a colored kind chip, the line under the title (a passage's verse
 * ruler, a pack's dots), and a stacked edge under packs. A verse has no
 * preview of its words.
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
  const stacked = goal.kind === "pack";

  return (
    <div
      className={cn("relative flex w-full min-w-0 flex-col", stacked && "pb-2")}
    >
      {stacked ? <StackEdge /> : null}
      <div className="group relative flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md has-[[data-goal-link]:focus-visible]:outline-2 has-[[data-goal-link]:focus-visible]:outline-offset-2 has-[[data-goal-link]:focus-visible]:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <GoalKindChip kind={goal.kind} className="mb-1.5">
              {model.kindLabel}
            </GoalKindChip>
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
          </div>
          {model.chip ? <Chip chip={model.chip} /> : null}
        </div>

        {model.signature.kind === "verse" ? null : (
          <Signature signature={model.signature} />
        )}

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
    </div>
  );
}

/** Two sheets peeking out under a pack's card. */
function StackEdge() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-x-4 bottom-0 h-6 rounded-b-xl border bg-card shadow-xs"
      />
      <div
        aria-hidden
        className="absolute inset-x-2 bottom-1 h-6 rounded-b-xl border bg-card shadow-xs"
      />
    </>
  );
}

function Signature({
  signature,
}: {
  signature: Exclude<GoalSignature, { kind: "verse" }>;
}) {
  switch (signature.kind) {
    case "passage":
      return <PassageRuler signature={signature} />;
    case "pack":
      return <PackDots signature={signature} />;
  }
}

/**
 * One tick per verse, filled once learned, raised for today's verses. A
 * memorized passage's ruler is all filled, so it is decoration beside its
 * Mastery bar rather than a second progress bar.
 */
function PassageRuler({
  signature,
}: {
  signature: Extract<GoalSignature, { kind: "passage" }>;
}) {
  const building = signature.phase === "building";
  const fill = building
    ? "bg-primary"
    : MEMORY_STATUS_STYLE[
        signature.phase === "mastered" ? "mastered" : "reviewing"
      ].bar;
  const percent = toPercent(signature.fraction);
  const meter: HTMLAttributes<HTMLDivElement> = building
    ? {
        role: "progressbar",
        "aria-label": signature.ariaLabel,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": percent,
      }
    : { "aria-hidden": true };
  const ticks =
    signature.ticks.length > 0 && signature.ticks.length <= RULER_TICK_LIMIT;

  return (
    <div className="grid gap-1">
      <TrackLabel label={signature.label} detail={signature.detail} />
      {ticks ? (
        <div {...meter} className="flex h-2.5 items-end gap-0.5">
          {signature.ticks.map((tick, index) => (
            <span
              key={index}
              className={cn(
                "min-w-0 flex-1 rounded-[2px]",
                tick.today ? "h-2.5" : "h-1.5",
                tick.state === "learned"
                  ? fill
                  : tick.state === "learning"
                    ? "bg-primary/35"
                    : "bg-muted",
              )}
            />
          ))}
        </div>
      ) : (
        <div {...meter} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", fill)}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** One dot per verse in status colors, most learned first; Up next is hollow. */
function PackDots({
  signature,
}: {
  signature: Extract<GoalSignature, { kind: "pack" }>;
}) {
  const total = signature.members.reduce((sum, group) => sum + group.count, 0);
  return (
    <div className="grid gap-1.5">
      <TrackLabel label={signature.label} detail={signature.detail} />
      <div
        role="progressbar"
        aria-label={signature.ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={toPercent(signature.fraction)}
      >
        {total <= PACK_DOT_LIMIT ? (
          <div className="flex flex-wrap gap-1">
            {signature.members.flatMap((group) =>
              Array.from({ length: group.count }, (_, index) => (
                <span
                  key={`${group.status}-${index}`}
                  className={cn(
                    "size-2.5 rounded-full",
                    group.status === "new"
                      ? "border-[1.5px] border-slate-400 dark:border-slate-500"
                      : MEMORY_STATUS_STYLE[group.status].dot,
                  )}
                />
              )),
            )}
          </div>
        ) : (
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            {signature.members.map((group) =>
              group.status === "new" ? null : (
                <span
                  key={group.status}
                  className={cn(
                    "h-full",
                    MEMORY_STATUS_STYLE[group.status].bar,
                  )}
                  style={{ width: `${(group.count / total) * 100}%` }}
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ chip }: { chip: GoalChip }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300">
      <Check aria-hidden className="size-3" />
      {chip.label}
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

function TrackLabel({
  label,
  detail,
  muted = false,
}: {
  label: string;
  detail: string | null;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-2 text-xs",
        muted && "text-muted-foreground",
      )}
    >
      <span className={cn(!muted && "font-medium")}>{label}</span>
      {detail ? <span className="text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

function Track({ bar }: { bar: GoalBar }) {
  const mastery = bar.track === "mastery";
  const percent = toPercent(bar.fraction);
  return (
    <div className="grid gap-1">
      <TrackLabel label={bar.label} detail={bar.detail} muted={mastery} />
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
    </div>
  );
}
