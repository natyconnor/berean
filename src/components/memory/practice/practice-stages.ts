import type { HintStage } from "@/lib/verse-hint";

export interface PracticeStageInfo {
  stage: HintStage;
  label: string;
}

/**
 * The four masking rungs the practice stage selector maps onto, in ascending
 * difficulty. Index 0..3 lines up with the four `maskVerseText` stages.
 */
export const PRACTICE_STAGES: readonly PracticeStageInfo[] = [
  { stage: "full", label: "Full" },
  { stage: "first-letters", label: "Letters" },
  { stage: "cloze", label: "Blanks" },
  { stage: "hidden", label: "Hidden" },
] as const;
