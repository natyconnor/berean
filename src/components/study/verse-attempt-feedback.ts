import {
  wordErrorCount,
  type AttemptErrorCounts,
} from "@/components/study/study-attempt-quality";
import { formatNextReviewPhrase } from "@/lib/memory-due-label";
import {
  type MemorySchedule,
  type ReviewGradeOutcome,
} from "@/lib/memory-scheduler";

/**
 * Input for a graded-attempt lead. `errors` unlocks one-word-off and
 * typo-only copy; without it, only accuracy bands apply.
 */
export interface AttemptFeedbackInput {
  accuracy: number;
  outcome: ReviewGradeOutcome;
  errors?: AttemptErrorCounts;
}

type AccuracyLead = {
  min: number;
  lead: string;
};

/**
 * Fine-grained retry copy (80–99, not exact). First matching `min` wins.
 * Specials (one word off, typos-only) take priority over these.
 */
export const RETRY_ACCURACY_LEADS: readonly AccuracyLead[] = [
  { min: 98, lead: "One breath away from perfect" },
  { min: 96, lead: "So close to perfect" },
  { min: 93, lead: "You've pretty much got this" },
  { min: 90, lead: "Tiny slip — the verse is in there" },
  { min: 87, lead: "That was pretty good" },
  { min: 84, lead: "You're getting there" },
  { min: 80, lead: "Almost there" },
];

/** Fine-grained hold copy (60–79). Specials still win when they apply. */
export const HOLD_ACCURACY_LEADS: readonly AccuracyLead[] = [
  { min: 77, lead: "Solid recall, with a few holes" },
  { min: 73, lead: "The shape of the verse is there" },
  { min: 70, lead: "Mostly there, but it needs some work" },
  { min: 66, lead: "More right than wrong" },
  { min: 63, lead: "You remembered a good bit" },
  { min: 60, lead: "Enough to keep the same review interval" },
];

/** Fine-grained lapse copy (below 60). */
export const LAPSE_ACCURACY_LEADS: readonly AccuracyLead[] = [
  { min: 55, lead: "Getting there — this one needs another round" },
  { min: 50, lead: "Halfway home" },
  { min: 45, lead: "Some of it stuck" },
  { min: 40, lead: "A handful of words came back" },
  { min: 30, lead: "A few fragments this time" },
  { min: 20, lead: "Mostly slipped away" },
  { min: 10, lead: "This one got away" },
  { min: 0, lead: "Blank slate this round — we'll rebuild it" },
];

function leadForAccuracy(
  bands: readonly AccuracyLead[],
  accuracy: number,
): string {
  for (const band of bands) {
    if (accuracy >= band.min) return band.lead;
  }
  return bands[bands.length - 1]?.lead ?? "";
}

/**
 * Copy that names the miss when the diff is simple enough to celebrate.
 * Returns null when the miss is too mixed to call out specifically.
 */
export function specialMissLead(errors: AttemptErrorCounts): string | null {
  const words = wordErrorCount(errors);
  if (words === 1 && errors.missing === 1) {
    return "Oh so close! Just one word missing";
  }
  if (words === 1 && errors.extra === 1) {
    return "Oh so close! Just one extra word";
  }
  if (words === 1) {
    return "Oh so close! Just one word off";
  }
  if (words === 2) {
    return "So close — just two words off";
  }
  if (words === 3) {
    return "Almost — just three words off";
  }
  if (words === 0 && errors.typos >= 3) {
    return "The words are right — just a few spellings to tidy up";
  }
  return null;
}

function exactLead(errors: AttemptErrorCounts | undefined): string {
  const typos = errors?.typos ?? 0;
  if (typos === 1) return "Nailed it — just a tiny spelling slip";
  if (typos >= 2) return "Nailed it — a couple of spelling slips";
  return "Nailed it";
}

/**
 * Outcome-agnostic lead for a graded attempt. Review banners append a schedule
 * suffix; learning / practice can show the lead on its own.
 */
export function attemptFeedbackLead(input: AttemptFeedbackInput): string {
  if (input.outcome === "exact") {
    return exactLead(input.errors);
  }

  if (input.errors) {
    const special = specialMissLead(input.errors);
    if (special) return special;
  }

  if (input.outcome === "retry") {
    return leadForAccuracy(RETRY_ACCURACY_LEADS, input.accuracy);
  }
  if (input.outcome === "hold") {
    return leadForAccuracy(HOLD_ACCURACY_LEADS, input.accuracy);
  }
  return leadForAccuracy(LAPSE_ACCURACY_LEADS, input.accuracy);
}

function withNextReview(
  lead: string,
  schedule: MemorySchedule | null | undefined,
  now: number,
): string {
  const phrase = formatNextReviewPhrase(schedule, now);
  return phrase ? `${lead} — next review ${phrase}` : lead;
}

/**
 * Review-queue banner: lead plus the schedule consequence.
 *
 * Retry stays due, so we invite another attempt instead of naming a due date.
 */
export function reviewFeedbackMessage(input: {
  lead: string;
  outcome: ReviewGradeOutcome;
  nextSchedule?: MemorySchedule | null;
  now: number;
  lapsedToLearning: boolean;
}): string {
  if (input.outcome === "retry") {
    return `${input.lead} — try again to earn a longer wait.`;
  }
  if (input.outcome === "lapse" && input.lapsedToLearning) {
    return `${input.lead} — back to Challenge.`;
  }
  return withNextReview(input.lead, input.nextSchedule, input.now);
}
