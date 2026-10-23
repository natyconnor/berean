import { MAX_LEARN_STAGE, type MemoryStatus } from "./memory-scheduler";

/**
 * Glossary for every user-facing Memory string. Surfaces read their words from
 * here so "Memorize", step names, and status chips stay identical everywhere.
 *
 * The scheduler keeps its own internal band names (`SUPPORT_BANDS`); those are
 * never shown. Map a `learnStage` to display copy with {@link stepShortLabel}
 * and {@link stepActionLine} instead.
 */

export const MEMORIZE_LABEL = "Memorize";
export const START_MEMORIZING_LABEL = "Start memorizing";
export const TODAY_LABEL = "Today";
export const MEMORY_LABEL = "Memory";
export const START_TODAY_LABEL = "Start today";
export const EXTRA_PRACTICE_LABEL = "Extra practice";
export const EXTRA_PRACTICE_TOOLTIP =
  "Go over anything you've memorized, any time.";
/** Practice for one passage or pack; shares the Extra practice tooltip. */
export const PRACTICE_ANYTIME_LABEL = "Practice anytime";
export const YOUR_VERSES_LABEL = "Your verses";
export const YOUR_PROGRESS_LABEL = "Your progress";
export const SUGGESTIONS_LABEL = "Suggestions";

/** Waiting state for a verse whose step for today is done. */
export const UP_NEXT_TOMORROW_LABEL = "Up next tomorrow";

export type LearnActionLabel = "Learn" | "Continue learning";

export type LearningProgress = {
  learnStage: number;
  stageReps?: number;
  lastReviewedAt?: number;
};

/** A verse has started: a step passed, a rep banked, or any attempt logged. */
export function hasLearningProgress(progress: LearningProgress): boolean {
  return (
    progress.learnStage > 0 ||
    (progress.stageReps ?? 0) > 0 ||
    progress.lastReviewedAt !== undefined
  );
}

/** "Continue learning" once a verse has any learning progress, else "Learn". */
export function learnActionLabel(progress: LearningProgress): LearnActionLabel {
  return hasLearningProgress(progress) ? "Continue learning" : "Learn";
}

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

function clampLearnStage(learnStage: number): number {
  if (!Number.isFinite(learnStage)) return 0;
  return Math.max(0, Math.min(MAX_LEARN_STAGE, Math.trunc(learnStage)));
}

/** Display name for a learning step (`learnStage` 0..3). */
export function stepShortLabel(learnStage: number): StepShortLabel {
  return STEP_SHORT_LABELS[clampLearnStage(learnStage)] ?? "Read";
}

export type StepLadderDay = 1 | 2 | 3;

/** Which of the three learning sessions `learnStage` falls in. */
export function stepLadderDay(learnStage: number): StepLadderDay {
  const stage = clampLearnStage(learnStage);
  if (stage <= 1) return 1;
  return stage === 2 ? 2 : 3;
}

/** Read and First letters share one session; the scheduler soft-locks after each later step. */
const STEP_ACTIONS: Record<StepLadderDay, string> = {
  1: "read it, then type it with first letters",
  2: "fill in the blanks",
  3: "say it from memory",
};

function capitalize(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** What one verse's step asks for at `learnStage`, e.g. "fill in the blanks". */
export function stepAction(learnStage: number): string {
  return STEP_ACTIONS[stepLadderDay(learnStage)];
}

/** {@link stepAction} as a line on its own: "Fill in the blanks". */
export function stepActionLine(learnStage: number): string {
  return capitalize(stepAction(learnStage));
}

/**
 * Today's step for some verses of a passage, e.g. "Fill in the blanks for
 * verses 1–2". `verses` names them ("verse 3", "verses 5–6").
 */
export function passageStepLine(
  learnStage: number,
  verses: string,
  plural: boolean,
): string {
  switch (stepLadderDay(learnStage)) {
    case 1:
      return `Read ${verses}, then type ${plural ? "them" : "it"} with first letters`;
    case 2:
      return `Fill in the blanks for ${verses}`;
    case 3:
      return `Say ${verses} from memory`;
  }
}

/** "Fill in the blanks for verse 3" → "Today:" and "fill in the blanks for verse 3." */
export function todayStepParts(line: string): { lead: string; rest: string } {
  return {
    lead: `${TODAY_LABEL}:`,
    rest: `${line.charAt(0).toLowerCase()}${line.slice(1)}.`,
  };
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

export const NEED_A_REFRESHER_LABEL = "Need a refresher?";
export const FIRST_LETTERS_HINT_LABEL = "First letters";
export const ENTER_TO_CHECK_HINT =
  "Enter to check · Shift+Enter for a new line";
export const REFRESH_LABEL = "Refresh";
export const REFRESH_MENU_DETAIL = "Practice with hints";
export const START_OVER_MENU_LABEL = "Start over…";
export const START_OVER_MENU_DETAIL = "Learn it again from the start";
export const START_OVER_CONFIRM_LABEL = "Start over";
export const START_OVER_CANCEL_LABEL = "Cancel";
export const STARTED_OVER_LABEL = "Started over.";
export const UNDO_LABEL = "Undo";
export const START_OVER_ERROR = "Couldn't start over. Try again.";
export const UNDO_START_OVER_ERROR = "Couldn't undo. Try again.";
export const REFRESH_START_ERROR = "Couldn't start the refresher. Try again.";
export const REFRESH_FINISH_ERROR = "Couldn't finish the refresher. Try again.";
export const START_OVER_CONFIRM_BODY =
  "You'll learn it again from the beginning. Your notes and hearts stay.";
export const WHOLE_PASSAGE_OPTION = "The whole passage";
export const WHOLE_PACK_OPTION = "The whole pack";

export function startOverTitle(name: string): string {
  return `Start ${name} over?`;
}

export function shakyVersesOption(list: string): string {
  return `Just the shaky verses · ${list}`;
}

/** Up to four refs, then "+N more". */
export function formatShakyVerseList(refs: readonly string[], max = 4): string {
  if (refs.length <= max) return refs.join(", ");
  return `${refs.slice(0, max).join(", ")} +${refs.length - max} more`;
}
