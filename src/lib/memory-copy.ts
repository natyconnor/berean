import {
  isReviewPhase,
  MAX_LEARN_STAGE,
  type MemoryStatus,
} from "./memory-scheduler";
import type { PieceAttachment } from "./passage-pieces";

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

/**
 * Start over is offered once there is real progress since the last reset, or
 * the verse is already Memorized or Mastered.
 */
export function canStartOver(
  progress: LearningProgress & { status: MemoryStatus },
): boolean {
  return isReviewPhase(progress.status) || hasLearningProgress(progress);
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

export const START_OVER_MENU_LABEL = "Start over…";
export const START_OVER_MENU_DETAIL = "Learn it again from the start";
export const START_OVER_CONFIRM_LABEL = "Start over";
export const START_OVER_CANCEL_LABEL = "Cancel";
export const STARTED_OVER_LABEL = "Started over.";
export const START_OVER_ERROR = "Couldn't start over. Try again.";
export const START_OVER_CONFIRM_BODY =
  "You'll learn it again from the start, and this page will count from today. Your past tries aren't deleted, and your streak and overall stats stay as they are. This can't be undone.";

export function startOverTitle(name: string): string {
  return `Start ${name} over?`;
}

export function startOverPassageBody(count: number): string {
  return `You'll learn all ${count} verses again from the start, and this page will count from today. Your past tries aren't deleted, and your streak and overall stats stay as they are. This can't be undone.`;
}

export type PassageStartOverPiece = {
  attachment: PieceAttachment;
  learnStage: number;
  stageReps: number;
};

/** A passage shows Start over once a piece is attached, solid, or in progress. */
export function canStartOverPassage(
  pieces: readonly PassageStartOverPiece[],
): boolean {
  return pieces.some(
    (piece) =>
      piece.attachment === "attached" ||
      piece.attachment === "solid" ||
      piece.learnStage > 0 ||
      piece.stageReps > 0,
  );
}

export const NEED_A_REFRESHER_LABEL = "Need a refresher?";
export const NEED_A_REFRESHER_TOOLTIP =
  "Do a refresher on this verse for some more practice.";
export const NEED_A_REFRESHER_PASSAGE_TOOLTIP =
  "Do a refresher on this passage for some more practice.";
export const TRY_ANOTHER_REFRESHER_LABEL = "Try another refresher";
export const REFRESH_IT_FIRST_LABEL = "Refresh it first";
export const PRACTICE_ONLY_CLOSING =
  "Practice only, your progress didn't change.";
export const PRACTICE_PASS_LEAD = "Good work getting back on track.";
export const PRACTICE_PASS_REST =
  "Next time, see if you can do it on the first try.";
export const PRACTICE_PASS_EMOJI = "👍";
export const NOW_TRY_WITHOUT_HINTS = "Now try it without the hints.";
export const REFRESH_SAVE_ERROR = "Couldn't save your result. Try again.";
export const REFRESH_MENU_LABEL = "Refresh";
export const REFRESH_START_ERROR = "Couldn't start the refresher. Try again.";
/** Header Back of a Refresh started from a session summary, which it returns to. */
export const SUMMARY_REFRESH_BACK_LABEL = "Back to summary";
export const COUNTED_TODAY_CLOSING = "Counted as today's review";
/** A summary row whose verse dropped back to Learning in this session. */
export const LAPSED_ROW_LINE =
  "Looks like you're struggling with this one. Let's learn it again.";

/**
 * "Refresh · First letters · 1 of 2" / "Refresh · From memory · 2 of 2", or
 * 1 of 3 / 2 of 3 / 3 of 3 once an every-word First letters step is added.
 * The last step is always From memory.
 */
export function refresherHeader(step: 1 | 2 | 3, total: 2 | 3 = 2): string {
  const label = stepShortLabel(step === total ? 3 : 1);
  return `Refresh · ${label} · ${step} of ${total}`;
}
