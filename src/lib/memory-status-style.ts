import type { MemoryStatus } from "./memory-scheduler";

/**
 * Canonical visual language for the four verse-memory lifecycle statuses,
 * shared by the dashboard Mastery bar and the Library so the two can never
 * drift apart.
 *
 * The palette is an intentional *progression* toward mastery rather than an
 * arbitrary set of chart tokens:
 * - `new` → slate: neutral, "saved but not started yet".
 * - `learning` → amber: warm, active effort.
 * - `reviewing` → sky: cooling off, consolidating in memory.
 * - `mastered` → emerald: success / done.
 *
 * These are Tailwind utility classes (not the `--chart-*` tokens) so they carry
 * their own light/dark treatment and stay distinct from the app's orange
 * "activity" accent used by the heatmap, accuracy line, and streak flame.
 */
export interface MemoryStatusStyle {
  label: string;
  /** Solid fill for bar segments. */
  bar: string;
  /** Solid fill for legend / list dots. */
  dot: string;
  /** Foreground text tint for inline labels. */
  text: string;
}

export const MEMORY_STATUS_STYLE: Record<MemoryStatus, MemoryStatusStyle> = {
  new: {
    label: "New",
    bar: "bg-slate-400 dark:bg-slate-500",
    dot: "bg-slate-400 dark:bg-slate-500",
    text: "text-slate-600 dark:text-slate-300",
  },
  learning: {
    label: "Learning",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  reviewing: {
    label: "Reviewing",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  mastered: {
    label: "Mastered",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

/** Lifecycle order: left-to-right reflects progression toward mastery. */
export const MEMORY_STATUS_ORDER: readonly MemoryStatus[] = [
  "new",
  "learning",
  "reviewing",
  "mastered",
];
