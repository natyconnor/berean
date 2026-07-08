import type { HintStage } from "@/lib/verse-hint";

export interface PracticeStageInfo {
  stage: HintStage;
  label: string;
  color: {
    dot: string;
    text: string;
    panel: string;
    selectedButton: string;
    railActive: string;
  };
}

/**
 * The four masking rungs the practice stage selector maps onto, in ascending
 * difficulty. Index 0..3 lines up with the four `maskVerseText` stages.
 */
export const PRACTICE_STAGES: readonly PracticeStageInfo[] = [
  {
    stage: "full",
    label: "Full",
    color: {
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-300",
      panel:
        "border-emerald-500/25 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10",
      selectedButton:
        "bg-emerald-500/15 text-emerald-900 shadow-sm ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-100",
      railActive:
        "border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
    },
  },
  {
    stage: "first-letters",
    label: "Letters",
    color: {
      dot: "bg-sky-500",
      text: "text-sky-700 dark:text-sky-300",
      panel:
        "border-sky-500/25 bg-sky-500/5 dark:border-sky-400/20 dark:bg-sky-400/10",
      selectedButton:
        "bg-sky-500/15 text-sky-900 shadow-sm ring-1 ring-inset ring-sky-500/25 dark:text-sky-100",
      railActive:
        "border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100",
    },
  },
  {
    stage: "cloze",
    label: "Blanks",
    color: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-300",
      panel:
        "border-amber-500/30 bg-amber-500/5 dark:border-amber-400/25 dark:bg-amber-400/10",
      selectedButton:
        "bg-amber-500/15 text-amber-900 shadow-sm ring-1 ring-inset ring-amber-500/30 dark:text-amber-100",
      railActive:
        "border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100",
    },
  },
  {
    stage: "hidden",
    label: "Hidden",
    color: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-300",
      panel:
        "border-rose-500/25 bg-rose-500/5 dark:border-rose-400/20 dark:bg-rose-400/10",
      selectedButton:
        "bg-rose-500/15 text-rose-900 shadow-sm ring-1 ring-inset ring-rose-500/25 dark:text-rose-100",
      railActive:
        "border-rose-500/35 bg-rose-500/15 text-rose-950 dark:text-rose-100",
    },
  },
] as const;
