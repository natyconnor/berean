import {
  isLearningPhase,
  MAX_LEARN_STAGE,
  type MemoryStatus,
} from "@/lib/memory-scheduler";

/** Close-but-not-exact From Memory copy: 100% is required to bank a rep. */
export const FROM_MEMORY_CLOSE_MESSAGE =
  "Good job, but let's get 100% to lock this verse in.";

export const FROM_MEMORY_FIRST_ROUND_PROMPT = "Recall the verse from memory";

export const FROM_MEMORY_SECOND_ROUND_PROMPT =
  "Let's do it one more time to really show you've got this one down!";

/** True while the learner is still on the From Memory band (not yet graduated). */
export function isFromMemoryLearning(
  learnStage: number,
  status: MemoryStatus,
): boolean {
  return learnStage >= MAX_LEARN_STAGE && isLearningPhase(status);
}

/** Prompt for the current From Memory recall (always two exacts to graduate). */
export function fromMemoryPromptLine(stageReps: number): string {
  return stageReps >= 1
    ? FROM_MEMORY_SECOND_ROUND_PROMPT
    : FROM_MEMORY_FIRST_ROUND_PROMPT;
}
