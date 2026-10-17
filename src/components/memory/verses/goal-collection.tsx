import { useId, useState } from "react";
import { ArrowUpDown, Layers, Plus } from "lucide-react";

import { useMemoryPanelFrame } from "@/components/memory/drawer/memory-panel-context";
import { InternalLink } from "@/components/memory/internal-link";
import { MemoryListRow } from "@/components/memory/memory-surface";
import { GoalKindMark } from "@/components/memory/today/goal-kind-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TodayModelResult } from "@/hooks/use-today-model";
import { SUGGESTIONS_LABEL } from "@/lib/memory-copy";
import { goalKey, goalPanel, searchGoals } from "@/lib/memory-verses-drawer";
import {
  filterGoals,
  GOAL_KIND_FILTERS,
  GOAL_SORTS,
  GOAL_STAGE_FILTERS,
  sortGoals,
  type GoalKindFilter,
  type GoalRowGoal,
  type GoalSort,
  type GoalStageFilter,
} from "@/lib/your-verses-goals";

import { GoalListRow } from "./goal-list-row";

const FILTER_BUTTON_CLASS = "h-7 px-2.5 text-xs max-sm:h-9";
const ROWS_CLASS = "grid gap-1.5 @3xl:grid-cols-2";

/**
 * Your verses' Passages and packs: one row each, then any pack with nothing
 * in Memory. `controls` adds the kind and stage filters and the sort; `query`
 * narrows by title or pack verse. Rows open their detail with a way back to
 * Your verses.
 */
export function GoalCollection({
  today,
  now,
  timeZone,
  query,
  controls,
}: {
  today: TodayModelResult;
  now: number;
  timeZone?: string;
  query: string;
  controls: boolean;
}) {
  const frame = useMemoryPanelFrame();
  const headingId = useId();
  const [kind, setKind] = useState<GoalKindFilter>("all");
  const [stage, setStage] = useState<GoalStageFilter | null>(null);
  const [sort, setSort] = useState<GoalSort>("today");

  const goals = today.goals.filter(
    (goal): goal is Extract<typeof goal, GoalRowGoal> => goal.kind !== "verse",
  );
  const total = goals.length + today.emptyPacks.length;
  const trimmed = query.trim();
  const searched =
    trimmed.length > 0
      ? searchGoals(goals, trimmed).map((hit) => hit.goal)
      : goals;
  const shown = sortGoals(filterGoals(searched, kind, stage), sort);
  const emptyPacks =
    kind !== "passage" && stage === null
      ? today.emptyPacks.filter((pack) =>
          pack.title.toLowerCase().includes(trimmed.toLowerCase()),
        )
      : [];
  const filtered = kind !== "all" || stage !== null;

  return (
    <section aria-labelledby={headingId} className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={headingId}
          className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
        >
          Passages and packs <span className="tabular-nums">· {total}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 max-sm:h-11"
          >
            <InternalLink href="/memory/presets">
              {SUGGESTIONS_LABEL}
            </InternalLink>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 max-sm:h-11"
          >
            <InternalLink href="/memory/new">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New pack
            </InternalLink>
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center">
          <Layers
            className="mx-auto mb-3 h-6 w-6 text-muted-foreground/70"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            Memorize a chapter from the reader, or make a pack of verses you
            want to keep together.
          </p>
        </div>
      ) : (
        <>
          {controls ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <div
                  role="group"
                  aria-label="Show"
                  className="flex flex-wrap items-center gap-1"
                >
                  {GOAL_KIND_FILTERS.map((option) => (
                    <Button
                      key={option.key}
                      variant={kind === option.key ? "secondary" : "ghost"}
                      size="sm"
                      className={FILTER_BUTTON_CLASS}
                      aria-pressed={kind === option.key}
                      onClick={() => setKind(option.key)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                <div
                  role="group"
                  aria-label="Filter by stage"
                  className="flex flex-wrap items-center gap-1"
                >
                  {GOAL_STAGE_FILTERS.map((option) => (
                    <Button
                      key={option.key}
                      variant={stage === option.key ? "secondary" : "ghost"}
                      size="sm"
                      className={FILTER_BUTTON_CLASS}
                      aria-pressed={stage === option.key}
                      onClick={() =>
                        setStage((current) =>
                          current === option.key ? null : option.key,
                        )
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <SortMenu sort={sort} onSortChange={setSort} />
            </div>
          ) : null}

          {shown.length === 0 && emptyPacks.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {trimmed.length > 0 && !filtered
                  ? `Nothing matches “${trimmed}”.`
                  : "Nothing matches these filters."}
              </p>
              {filtered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setKind("all");
                    setStage(null);
                  }}
                >
                  Show everything
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className={ROWS_CLASS}>
              {shown.map((goal) => (
                <li key={goalKey(goal)} className="min-w-0">
                  <GoalListRow
                    goal={goal}
                    now={now}
                    timeZone={timeZone}
                    detailHref={frame.hrefFor(goalPanel(goal), {
                      from: "verses",
                    })}
                    returnTo={frame.returnTo}
                  />
                </li>
              ))}
              {emptyPacks.map((pack) => (
                <li key={pack.packId} className="min-w-0">
                  <MemoryListRow>
                    <InternalLink
                      href={frame.hrefFor(
                        { kind: "pack", packId: pack.packId },
                        { from: "verses" },
                      )}
                      className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2"
                    >
                      <GoalKindMark kind="pack" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {pack.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Pack · nothing in Memory
                        </span>
                      </span>
                    </InternalLink>
                  </MemoryListRow>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function SortMenu({
  sort,
  onSortChange,
}: {
  sort: GoalSort;
  onSortChange: (sort: GoalSort) => void;
}) {
  const label = GOAL_SORTS.find((option) => option.key === sort)?.label ?? sort;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground max-sm:h-9"
          aria-label={`Sort: ${label}`}
        >
          <ArrowUpDown aria-hidden />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={sort}
          onValueChange={(value) => {
            const next = GOAL_SORTS.find((option) => option.key === value);
            if (next) onSortChange(next.key);
          }}
        >
          {GOAL_SORTS.map((option) => (
            <DropdownMenuRadioItem key={option.key} value={option.key}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
