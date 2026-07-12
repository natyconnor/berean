import {
  MAX_LEARN_STAGE,
  SUPPORT_BANDS,
  type MemoryStatus,
  type SupportBand,
} from "@/lib/memory-scheduler";
import type { HintStage } from "@/lib/verse-hint";

export interface PracticeChrome {
  dot: string;
  text: string;
  panel: string;
  selectedButton: string;
  railActive: string;
}

export interface PracticeStageInfo {
  stage: HintStage;
  /** Human label for this band, sourced from {@link SUPPORT_BANDS}. */
  label: string;
  /**
   * Short-verse minimum reps for this band, sourced from {@link SUPPORT_BANDS}.
   *
   * This is the **minimum / fallback** for short verses (≤10 words). For
   * length-adjusted rep counts use {@link requiredRepsFor} at call sites,
   * passing the verse's word count.
   */
  requiredReps: number;
  color: PracticeChrome;
}

/** Map a support-band key to the masking stage it renders with. */
const STAGE_BY_BAND_KEY: Record<SupportBand["key"], HintStage> = {
  read: "full",
  guided: "first-letters",
  challenge: "cloze",
  memory: "hidden",
};

/**
 * Practice chrome intentionally mirrors lifecycle colors: Read starts as New,
 * Guided/Challenge are Learning, From Memory is Reviewing, and Mastered gets
 * the emerald completion override via {@link practiceChromeFor}.
 */
const STAGE_COLORS: readonly PracticeChrome[] = [
  {
    dot: "bg-slate-400 dark:bg-slate-500",
    text: "text-slate-600 dark:text-slate-300",
    panel:
      "border-slate-400/30 bg-slate-400/5 dark:border-slate-500/25 dark:bg-slate-500/10",
    selectedButton:
      "bg-slate-400/15 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-400/25 dark:text-slate-100 dark:ring-slate-500/25",
    railActive:
      "border-slate-400/35 bg-slate-400/15 text-slate-950 dark:border-slate-500/35 dark:bg-slate-500/15 dark:text-slate-100",
  },
  {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    panel:
      "border-amber-500/30 bg-amber-500/5 dark:border-amber-400/25 dark:bg-amber-400/10",
    selectedButton:
      "bg-amber-500/15 text-amber-900 shadow-sm ring-1 ring-inset ring-amber-500/30 dark:text-amber-100",
    railActive:
      "border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100",
  },
  {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    panel:
      "border-amber-500/30 bg-amber-500/5 dark:border-amber-400/25 dark:bg-amber-400/10",
    selectedButton:
      "bg-amber-500/15 text-amber-900 shadow-sm ring-1 ring-inset ring-amber-500/30 dark:text-amber-100",
    railActive:
      "border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100",
  },
  {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    panel:
      "border-sky-500/25 bg-sky-500/5 dark:border-sky-400/20 dark:bg-sky-400/10",
    selectedButton:
      "bg-sky-500/15 text-sky-900 shadow-sm ring-1 ring-inset ring-sky-500/25 dark:text-sky-100",
    railActive:
      "border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100",
  },
];

const MASTERED_CHROME: PracticeChrome = {
  dot: "bg-emerald-500",
  text: "text-emerald-700 dark:text-emerald-300",
  panel:
    "border-emerald-500/25 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10",
  selectedButton:
    "bg-emerald-500/15 text-emerald-900 shadow-sm ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-100",
  railActive:
    "border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
};

/**
 * The four learning-phase bands the Practice surface renders, in ascending
 * difficulty. Labels and required reps come straight from {@link SUPPORT_BANDS}
 * (the single source of truth); index 0..3 lines up with `learnStage`.
 */
export const PRACTICE_STAGES: readonly PracticeStageInfo[] = SUPPORT_BANDS.map(
  (band, index) => ({
    stage: STAGE_BY_BAND_KEY[band.key],
    label: band.label,
    requiredReps: band.requiredReps,
    color: STAGE_COLORS[index] ?? STAGE_COLORS[0],
  }),
);

export function practiceChromeFor(
  learnStage: number,
  status?: MemoryStatus,
): PracticeChrome {
  if (status === "mastered") return MASTERED_CHROME;

  const clampedStage = Math.max(
    0,
    Math.min(MAX_LEARN_STAGE, Math.trunc(learnStage)),
  );
  return PRACTICE_STAGES[clampedStage]?.color ?? PRACTICE_STAGES[0].color;
}
