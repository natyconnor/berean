import { useId } from "react";
import { Check, Dumbbell, GraduationCap, Play, RotateCcw } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TodayModelResult } from "@/hooks/use-today-model";
import { normalizeTimeZone } from "@/lib/dashboard-buckets";
import {
  EXTRA_PRACTICE_LABEL,
  EXTRA_PRACTICE_TOOLTIP,
  START_TODAY_LABEL,
  TODAY_LABEL,
} from "@/lib/memory-copy";
import { withReturn } from "@/lib/memory-return";
import { memoryTodaySessionHref } from "@/lib/memory-session-path";
import {
  formatNextReviewDay,
  todayDoneLine,
  todayHeadline,
  todaySessionMinutes,
} from "@/lib/memory-today";
import { TODAY_RETURN } from "@/lib/today-goal-card";

const START_TODAY_HREF = withReturn(memoryTodaySessionHref(), TODAY_RETURN);
const ONLY_LEARNING_HREF = withReturn("/memory/learn", TODAY_RETURN);
const ONLY_REVIEWS_HREF = withReturn("/memory/review", TODAY_RETURN);
const EXTRA_PRACTICE_HREF = withReturn("/memory/practice", TODAY_RETURN);

const eyebrowClassName =
  "text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** "Friday, Oct 9" */
function formatTodayDate(now: number, timeZone?: string): string {
  const zone = timeZone === undefined ? undefined : normalizeTimeZone(timeZone);
  const key = zone ?? "";
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: zone,
    });
    dateFormatters.set(key, formatter);
  }
  return formatter.format(new Date(now));
}

/**
 * The Today card: what is left today and the one primary button that starts
 * it, or a small "all caught up" reward with no primary button at all.
 */
export function TodayCard({
  today,
  now,
  timeZone,
}: {
  today: TodayModelResult;
  now: number;
  timeZone?: string;
}) {
  const headingId = useId();
  const eyebrow = `${TODAY_LABEL} · ${formatTodayDate(now, timeZone)}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col justify-center rounded-xl border bg-card p-4 shadow-md sm:px-5 sm:py-[18px]"
    >
      <p className={eyebrowClassName}>{eyebrow}</p>
      {today.state === "caughtUp" ? (
        <CaughtUpBody
          today={today}
          now={now}
          timeZone={timeZone}
          headingId={headingId}
        />
      ) : (
        <WorkBody today={today} headingId={headingId} />
      )}
    </section>
  );
}

function WorkBody({
  today,
  headingId,
}: {
  today: TodayModelResult;
  headingId: string;
}) {
  const { counts } = today;
  const learning = counts.learningVerses + counts.passageSessions;
  const minutes = todaySessionMinutes(counts);
  const continuing = today.startedToday;
  const subline = continuing
    ? todayDoneLine(today.doneToday)
    : learning > 0 && counts.reviews > 0
      ? "New learning first, then reviews."
      : null;

  return (
    <>
      <h2
        id={headingId}
        className="mt-1 text-lg leading-snug font-semibold tracking-tight"
      >
        {todayHeadline(counts) ?? TODAY_LABEL}
      </h2>
      {subline ? (
        <p className="mt-0.5 text-[13px] text-muted-foreground">{subline}</p>
      ) : null}
      <div className="mt-3">
        <Button asChild className="h-10 px-[18px] max-sm:h-11 max-sm:w-full">
          <InternalLink href={START_TODAY_HREF}>
            <Play aria-hidden />
            {continuing ? "Continue" : START_TODAY_LABEL} · about {minutes} min
          </InternalLink>
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 max-sm:flex-col">
        {learning > 0 && counts.reviews > 0 ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="max-sm:h-11 max-sm:justify-start"
          >
            <InternalLink href={ONLY_LEARNING_HREF}>
              <GraduationCap aria-hidden />
              Only learning · {learning}
            </InternalLink>
          </Button>
        ) : null}
        {counts.reviews > 0 && learning > 0 ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="max-sm:h-11 max-sm:justify-start"
          >
            <InternalLink href={ONLY_REVIEWS_HREF}>
              <RotateCcw aria-hidden />
              Only reviews · {counts.reviews}
            </InternalLink>
          </Button>
        ) : null}
        {today.hasAnythingMemorized ? (
          <ExtraPracticeLink
            variant="ghost"
            className="text-muted-foreground max-sm:h-11"
          />
        ) : null}
      </div>
    </>
  );
}

function CaughtUpBody({
  today,
  now,
  timeZone,
  headingId,
}: {
  today: TodayModelResult;
  now: number;
  timeZone?: string;
  headingId: string;
}) {
  const when = formatNextReviewDay(today.nextReviewAt, now, timeZone);
  const done = todayDoneLine(today.doneToday);

  return (
    <>
      <div className="mt-2 flex items-center gap-3.5">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        >
          <Check className="size-5" />
        </span>
        <div className="min-w-0">
          <h2
            id={headingId}
            className="text-lg leading-snug font-semibold tracking-tight"
          >
            {when ? `All caught up · next review ${when}` : "All caught up"}
          </h2>
          {done ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{done}</p>
          ) : null}
        </div>
      </div>
      {today.hasAnythingMemorized ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ExtraPracticeLink variant="outline" className="max-sm:h-11" />
          <span className="text-xs text-muted-foreground">
            If you&apos;d like more.
          </span>
        </div>
      ) : null}
    </>
  );
}

function ExtraPracticeLink({
  variant,
  className,
}: {
  variant: "ghost" | "outline";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant={variant} size="sm" className={className}>
          <InternalLink href={EXTRA_PRACTICE_HREF}>
            <Dumbbell aria-hidden />
            {EXTRA_PRACTICE_LABEL}
          </InternalLink>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {EXTRA_PRACTICE_TOOLTIP}
      </TooltipContent>
    </Tooltip>
  );
}
