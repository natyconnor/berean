import {
  LEARN_PROGRESS_ACCURACY,
  REVIEW_LAPSE_ACCURACY,
} from "@/lib/memory-scheduler";

export type AccuracyBand = "exact" | "nearly" | "progress" | "again";

export interface AccuracyFeedback {
  band: AccuracyBand;
  /** The bold opening words. */
  lead: string;
  /** What follows the lead, or "" when the lead says it all. */
  rest: string;
  /** `lead` and `rest` as one sentence. */
  headline: string;
}

const COPY: Record<AccuracyBand, { lead: string; rest: string }> = {
  exact: { lead: "Word for word.", rest: "" },
  nearly: { lead: "Nearly there:", rest: "a couple of small slips." },
  progress: {
    lead: "Good progress.",
    rest: "The highlighted words are worth another look.",
  },
  again: {
    lead: "This one needs another pass.",
    rest: "We'll bring it back sooner.",
  },
};

/**
 * The band a graded attempt falls in. `exact` is the grader's verdict (it
 * forgives a stray typo), so it wins over the raw percentage. Thresholds are
 * the scheduler's, so the words match what the grade does.
 */
export function accuracyBand(accuracy: number, exact: boolean): AccuracyBand {
  if (exact) return "exact";
  if (accuracy >= LEARN_PROGRESS_ACCURACY) return "nearly";
  if (accuracy >= REVIEW_LAPSE_ACCURACY) return "progress";
  return "again";
}

/** The headline a result view leads with; the percentage sits under it. */
export function accuracyFeedback(
  accuracy: number,
  { exact }: { exact: boolean },
): AccuracyFeedback {
  const band = accuracyBand(accuracy, exact);
  const { lead, rest } = COPY[band];
  return { band, lead, rest, headline: rest ? `${lead} ${rest}` : lead };
}
