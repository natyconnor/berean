import { MAX_LEARN_STAGE, type MemoryStatus } from "./memory-scheduler";

/**
 * Glossary for every user-facing Memory string. Surfaces read their words from
 * here so "Memorize", step names, and status chips stay identical everywhere.
 *
 * The scheduler keeps its own internal band names (`SUPPORT_BANDS`); those are
 * never shown. Map a `learnStage` to display copy with {@link stepShortLabel}
 * and {@link stepDayLine} instead.
 */

export const MEMORIZE_LABEL = "Memorize";
export const START_MEMORIZING_LABEL = "Start memorizing";
export const TODAY_LABEL = "Today";
export const START_TODAY_LABEL = "Start today";
export const EXTRA_PRACTICE_LABEL = "Extra practice";
export const EXTRA_PRACTICE_TOOLTIP =
  "Go over anything you've memorized, any time.";
export const YOUR_VERSES_LABEL = "Your verses";
export const YOUR_PROGRESS_LABEL = "Your progress";
export const SUGGESTIONS_LABEL = "Suggestions";

/** Waiting state for a verse whose step for today is done. */
export const UP_NEXT_TOMORROW_LABEL = "Up next tomorrow";
/** Same waiting state where "Up next tomorrow" would not fit. */
export const TOMORROW_SHORT_LABEL = "Tomorrow";

export const SESSION_COMPLETE_TITLE = "That's today's step.";
export const SESSION_COMPLETE_FOOTER =
  "Each day builds on the last. See you tomorrow.";

/** "Memorize Psalm 1": the one start action, named for its target. */
export function memorizeTitleLabel(title: string): string {
  return `${MEMORIZE_LABEL} ${title}`;
}

export type StepShortLabel =
  "Read" | "First letters" | "Fill in the blanks" | "From memory";

const STEP_SHORT_LABELS: readonly StepShortLabel[] = [
  "Read",
  "First letters",
  "Fill in the blanks",
  "From memory",
];

/** Read and First letters share day 1; the scheduler soft-locks after each later step. */
const STEP_DAY_LINES: readonly string[] = [
  "Day 1 of 3: read it, then type it with first letters",
  "Day 1 of 3: read it, then type it with first letters",
  "Day 2 of 3: fill in the blanks",
  "Day 3 of 3: say it from memory",
];

function clampLearnStage(learnStage: number): number {
  if (!Number.isFinite(learnStage)) return 0;
  return Math.max(0, Math.min(MAX_LEARN_STAGE, Math.trunc(learnStage)));
}

/** Display name for a learning step (`learnStage` 0..3). */
export function stepShortLabel(learnStage: number): StepShortLabel {
  return STEP_SHORT_LABELS[clampLearnStage(learnStage)] ?? "Read";
}

/** What today's session asks for at `learnStage`, framed as day N of 3. */
export function stepDayLine(learnStage: number): string {
  return (
    STEP_DAY_LINES[clampLearnStage(learnStage)] ??
    "Day 1 of 3: read it, then type it with first letters"
  );
}

export type StatusLabel = "New" | "Learning" | "Memorized" | "Mastered";

const STATUS_LABELS: Record<MemoryStatus, StatusLabel> = {
  new: "New",
  learning: "Learning",
  reviewing: "Memorized",
  mastered: "Mastered",
};

/** Status chip text. `reviewing` reads as the achievement, "Memorized". */
export function statusLabel(status: MemoryStatus): StatusLabel {
  return STATUS_LABELS[status];
}
