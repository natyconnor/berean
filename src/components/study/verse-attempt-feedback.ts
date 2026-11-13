import {
  wordErrorCount,
  type AttemptErrorCounts,
} from "@/components/study/study-attempt-quality";
import { formatNextReviewPhrase } from "@/lib/memory-due-label";
import { learnAgainLine } from "@/lib/memory-copy";
import {
  REVIEW_LAPSE_LEARN_STAGE,
  type MemorySchedule,
  type ReviewGradeOutcome,
} from "@/lib/memory-scheduler";

/**
 * Input for a graded attempt's line. `errors` unlocks the one-word-off and
 * typo lines; without it, only the score lines apply.
 */
export interface AttemptFeedbackInput {
  accuracy: number;
  outcome: ReviewGradeOutcome;
  errors?: AttemptErrorCounts;
}

type ScoreLine = {
  min: number;
  line: string;
};

/**
 * The line for a score when nothing more specific applies. First matching
 * `min` wins. Each one looks forward; the percentage under it says how much.
 */
export const SCORE_LINES: readonly ScoreLine[] = [
  { min: 96, line: "Almost perfect!" },
  { min: 93, line: "You've pretty much got this." },
  { min: 90, line: "A few slips, but you know it." },
  { min: 87, line: "That was pretty good." },
  { min: 85, line: "Good work, just a few words to fix." },
  { min: 80, line: "Almost there." },
  { min: 73, line: "Mostly right, with a few gaps." },
  { min: 70, line: "Mostly there, but it needs some work." },
  { min: 60, line: "Getting there, but this one needs another round." },
  { min: 0, line: "You still need some work on this one." },
];

function lineForScore(accuracy: number): string {
  for (const band of SCORE_LINES) {
    if (accuracy >= band.min) return band.line;
  }
  return SCORE_LINES[SCORE_LINES.length - 1]?.line ?? "";
}

/**
 * Names the miss when the comparison is simple enough to count. Returns null
 * when the miss is too mixed to call out.
 */
export function specialMissLine(errors: AttemptErrorCounts): string | null {
  const words = wordErrorCount(errors);
  if (words === 1) return "So close! Just one word off.";
  if (words === 2) return "So close! Just two words off.";
  if (words === 3) return "Almost! Just three words off.";
  if (words === 0 && errors.typos >= 3) {
    return "Basically perfect, just a few typos!";
  }
  return null;
}

/** A perfect attempt; up to two typos still count as perfect. */
function exactLine(errors: AttemptErrorCounts | undefined): string {
  const typos = errors?.typos ?? 0;
  if (typos === 1) return "Basically perfect, just one typo!";
  if (typos >= 2) return "Basically perfect, just a couple of typos!";
  return "Perfect!";
}

/**
 * The result banner's one bold line for a graded attempt: perfect, then a
 * countable miss, then the line for the score.
 */
export function attemptFeedbackLine(input: AttemptFeedbackInput): string {
  if (input.outcome === "exact") {
    return exactLine(input.errors);
  }

  if (input.errors && (input.outcome === "pass" || input.outcome === "close")) {
    const special = specialMissLine(input.errors);
    if (special) return special;
  }

  return lineForScore(input.accuracy);
}

interface ReviewOutcomeInput {
  outcome: ReviewGradeOutcome;
  nextSchedule?: MemorySchedule | null;
  now: number;
  lapsedToLearning: boolean;
  /** A practice-only try: nothing reschedules, so a miss promises nothing. */
  unscheduled?: boolean;
}

/**
 * What the grade does to the schedule, as a sentence ("Next review in 3
 * days."): the result banner's closing line in Review. Null when nothing is
 * known to change.
 */
export function reviewOutcomeMessage(input: ReviewOutcomeInput): string | null {
  if (input.outcome === "lapse" && input.lapsedToLearning) {
    return learnAgainLine(REVIEW_LAPSE_LEARN_STAGE);
  }
  const phrase = formatNextReviewPhrase(input.nextSchedule, input.now);
  if (phrase) return `Next review ${phrase}.`;
  return input.outcome === "lapse" && !input.unscheduled
    ? "We'll review it again sooner."
    : null;
}
