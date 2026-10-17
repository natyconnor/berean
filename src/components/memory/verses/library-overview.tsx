import type { TodayModelResult } from "@/hooks/use-today-model";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { todayWorkCount } from "@/lib/memory-today";
import { cn } from "@/lib/utils";

import { StatusMixBar } from "./status-mix-bar";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Your verses at a glance: how many verses, passages and packs, what is due,
 * and every verse by status in one bar with its legend.
 */
export function LibraryOverview({ today }: { today: TodayModelResult }) {
  const passages = today.goals.filter((goal) => goal.kind === "passage").length;
  const packs =
    today.goals.filter((goal) => goal.kind === "pack").length +
    today.emptyPacks.length;
  const work = todayWorkCount(today.counts);
  const { learning, memorized, mastered } = today.statusCounts;
  const segments = [
    { status: "mastered" as const, count: mastered, label: "mastered" },
    { status: "reviewing" as const, count: memorized, label: "memorized" },
    { status: "learning" as const, count: learning, label: "learning" },
  ];
  const summary = [
    plural(today.totalInMemory, "verse"),
    passages > 0 ? plural(passages, "passage") : null,
    packs > 0 ? plural(packs, "pack") : null,
  ].filter((part): part is string => part !== null);

  return (
    <section
      aria-label="Overview"
      className="space-y-2 rounded-xl border bg-card px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <p className="font-semibold">{summary.join(" · ")}</p>
        <p className="text-xs text-muted-foreground">
          {today.state === "caughtUp"
            ? "All done today"
            : work > 0
              ? `${work} due today`
              : null}
        </p>
      </div>
      <StatusMixBar segments={segments} className="h-2" />
      <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <li key={segment.status} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                MEMORY_STATUS_STYLE[segment.status].dot,
              )}
            />
            {segment.count} {segment.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
