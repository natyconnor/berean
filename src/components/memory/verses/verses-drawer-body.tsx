import { useId, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Expand,
  GraduationCap,
  Layers,
  Play,
  RotateCcw,
  Search,
} from "lucide-react";

import { useMemoryPanelFrame } from "@/components/memory/drawer/memory-panel-context";
import { InternalLink } from "@/components/memory/internal-link";
import { MemoryListRow } from "@/components/memory/memory-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveNow } from "@/hooks/use-live-now";
import { useTodayModel, type TodayGoal } from "@/hooks/use-today-model";
import { memoryPanelFullPagePath } from "@/lib/memory-panel";
import { withReturn } from "@/lib/memory-return";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { todaySessionMinutes, todayWorkCount } from "@/lib/memory-today";
import {
  dueGoalRows,
  goalKey,
  goalPanel,
  goalSessionHref,
  goalStatusLine,
  recentGoals,
  searchGoals,
  type DueGoalRow,
} from "@/lib/memory-verses-drawer";
import { cn } from "@/lib/utils";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

const SEARCH_LABEL = "Search your verses, passages and packs";

/**
 * The compact Your verses drawer: search, what is due today grouped by goal,
 * the most recently active goals, and a way to the full list.
 */
export function VersesDrawerBody() {
  const now = useLiveNow();
  const timeZone = getViewerTimeZone();
  const today = useTodayModel(now);
  const frame = useMemoryPanelFrame();
  const [query, setQuery] = useState("");
  const dueId = useId();
  const recentId = useId();

  if (today === undefined) return <VersesDrawerSkeleton />;

  const allHref = memoryPanelFullPagePath({ kind: "verses" });
  if (today.state === "firstRun") {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing here yet. What you memorize shows up here.
        </p>
      </div>
    );
  }

  const work = todayWorkCount(today.counts);
  const minutes = todaySessionMinutes(today.counts);
  const due = dueGoalRows(today.goals);
  const recent = recentGoals(today.goals, now);
  const trimmed = query.trim();
  const hits = searchGoals(today.goals, trimmed);
  const total = today.totalInMemory;
  const detailHref = (goal: TodayGoal) =>
    frame.hrefFor(goalPanel(goal), { from: "verses" });

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`${SEARCH_LABEL}…`}
          aria-label={SEARCH_LABEL}
          className="h-10 pl-9"
        />
      </div>

      {trimmed.length > 0 ? (
        <section aria-label="Search results">
          {hits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{trimmed}”.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {hits.map((hit) => (
                <GoalLinkRow
                  key={goalKey(hit.goal)}
                  goal={hit.goal}
                  line={
                    hit.matchedMember === null
                      ? goalStatusLine(hit.goal, now, timeZone)
                      : `Includes ${hit.matchedMember}`
                  }
                  href={detailHref(hit.goal)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {work > 0 && due.length > 0 ? (
            <section aria-labelledby={dueId} className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={dueId} className="text-sm font-semibold">
                  Due today · {work}
                </h3>
                <Button asChild size="sm" className="max-sm:h-11">
                  <InternalLink
                    href={withReturn("/memory/today", frame.returnTo)}
                  >
                    <Play aria-hidden />
                    Do all {work} · about {minutes} min
                  </InternalLink>
                </Button>
              </div>
              <ul className="grid gap-1.5">
                {due.map((row) => (
                  <DueRowItem
                    key={goalKey(row.goal)}
                    row={row}
                    href={withReturn(
                      goalSessionHref(row.goal, row.action),
                      frame.returnTo,
                    )}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {recent.goals.length > 0 ? (
            <section aria-labelledby={recentId} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id={recentId} className="text-sm font-semibold">
                  Recently active
                </h3>
                {recent.lastWeek ? (
                  <span className="text-xs text-muted-foreground">
                    Last 7 days
                  </span>
                ) : null}
              </div>
              <ul className="grid gap-1.5">
                {recent.goals.map((goal) => (
                  <GoalLinkRow
                    key={goalKey(goal)}
                    goal={goal}
                    line={goalStatusLine(goal, now, timeZone)}
                    href={detailHref(goal)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <Button asChild variant="outline" className="w-full max-sm:h-11">
        <InternalLink href={allHref}>
          <Expand aria-hidden />
          {total > 1
            ? `All ${total} verses, filters and packs`
            : "All verses, filters and packs"}
        </InternalLink>
      </Button>
    </div>
  );
}

function DueRowItem({
  row,
  href,
}: {
  row: DueGoalRow<TodayGoal>;
  href: string;
}) {
  const label = row.action === "learn" ? "Learn" : "Review";
  const Icon = row.action === "learn" ? GraduationCap : RotateCcw;
  return (
    <li>
      <MemoryListRow className="flex items-center gap-3 px-3 py-2.5">
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            MEMORY_STATUS_STYLE[row.tone].dot,
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {row.detail}
          </p>
        </div>
        <Button
          asChild
          size="xs"
          variant="outline"
          className="max-sm:h-11 max-sm:px-3"
        >
          <InternalLink href={href} aria-label={`${label} ${row.goal.title}`}>
            <Icon aria-hidden />
            {label}
          </InternalLink>
        </Button>
      </MemoryListRow>
    </li>
  );
}

function GoalLinkRow({
  goal,
  line,
  href,
}: {
  goal: TodayGoal;
  line: string;
  href: string;
}) {
  return (
    <li>
      <MemoryListRow>
        <InternalLink
          href={href}
          className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          >
            {goal.kind === "passage" ? (
              <BookOpen className="h-4 w-4" />
            ) : goal.kind === "pack" ? (
              <Layers className="h-4 w-4" />
            ) : (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  MEMORY_STATUS_STYLE[goal.status].dot,
                )}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {goal.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {line}
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
        </InternalLink>
      </MemoryListRow>
    </li>
  );
}

function VersesDrawerSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading your verses"
    >
      <div className="h-10 animate-pulse rounded-md bg-muted" aria-hidden />
      <div className="space-y-2" aria-hidden>
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
