import type { ReactNode } from "react";
import { BookOpen, Layers, Quote, type LucideIcon } from "lucide-react";

import type { GoalCard } from "@/lib/memory-goals";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<GoalCard["kind"], LucideIcon> = {
  passage: BookOpen,
  pack: Layers,
  verse: Quote,
};

/**
 * Fixed hues, kept apart from status colors (emerald, sky, amber), so a pack,
 * a passage, and a verse stay distinct in every theme.
 */
const KIND_TONE: Record<GoalCard["kind"], string> = {
  pack: "border-orange-700/25 bg-orange-500/15 text-orange-900 dark:border-orange-300/30 dark:bg-orange-400/15 dark:text-orange-200",
  passage:
    "border-teal-700/25 bg-teal-500/15 text-teal-900 dark:border-teal-300/30 dark:bg-teal-400/15 dark:text-teal-200",
  verse:
    "border-violet-700/25 bg-violet-500/15 text-violet-900 dark:border-violet-300/30 dark:bg-violet-400/15 dark:text-violet-200",
};

/** The same hues as {@link KIND_TONE}, as icon color alone. */
const KIND_TEXT: Record<GoalCard["kind"], string> = {
  pack: "text-orange-700 dark:text-orange-300",
  passage: "text-teal-700 dark:text-teal-300",
  verse: "text-violet-700 dark:text-violet-300",
};

/**
 * A passage is an open book, a pack a stack of layers, a verse a quote.
 * `tinted` colors it in the kind's hue, for a mark too small for its square.
 */
export function GoalKindIcon({
  kind,
  className,
  tinted = false,
}: {
  kind: GoalCard["kind"];
  className?: string;
  tinted?: boolean;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <Icon aria-hidden className={cn(tinted && KIND_TEXT[kind], className)} />
  );
}

/** Icon and name in one colored chip, so the kind reads before the title. */
export function GoalKindChip({
  kind,
  children,
  className,
}: {
  kind: GoalCard["kind"];
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-none font-semibold tracking-[0.12em] uppercase",
        KIND_TONE[kind],
        className,
      )}
    >
      <GoalKindIcon kind={kind} className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** The kind's icon in a colored square, for a row or a page title. */
export function GoalKindMark({
  kind,
  className,
}: {
  kind: GoalCard["kind"];
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg border",
        KIND_TONE[kind],
        className,
      )}
    >
      <GoalKindIcon kind={kind} className="size-4" />
    </span>
  );
}
