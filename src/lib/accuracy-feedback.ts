import {
  LEARN_PROGRESS_ACCURACY,
  REVIEW_LAPSE_ACCURACY,
} from "@/lib/memory-scheduler";

export type AccuracyBand = "exact" | "pass" | "close" | "miss";

export interface AccuracyFeedback {
  band: AccuracyBand;
  /** The bold opening words. */
  lead: string;
  /** What follows the lead, or "" when the lead says it all. */
  rest: string;
  /** `lead` and `rest` as one sentence. */
  headline: string;
  /** Leads the result banner; only a word-for-word recall gets the party. */
  emoji: string;
}

const COPY: Record<
  AccuracyBand,
  { lead: string; rest: string; emoji: string }
> = {
  exact: { lead: "Word for word.", rest: "", emoji: "🎉" },
  pass: {
    lead: "Well remembered.",
    rest: "Just a few words to tidy up.",
    emoji: "🙌",
  },
  close: {
    lead: "So close.",
    rest: "A few words slipped. The highlighted ones are worth another look.",
    emoji: "🌱",
  },
  miss: {
    lead: "This one needs more time.",
    rest: "We'll bring it back sooner.",
    emoji: "📖",
  },
};

/**
 * The band a graded attempt falls in. `exact` is the grader's verdict (it
 * forgives a stray typo), so it wins over the raw percentage. Thresholds are
 * the scheduler's, so the words match what the grade does.
 */
export function accuracyBand(accuracy: number, exact: boolean): AccuracyBand {
  if (exact) return "exact";
  if (accuracy >= LEARN_PROGRESS_ACCURACY) return "pass";
  if (accuracy >= REVIEW_LAPSE_ACCURACY) return "close";
  return "miss";
}

/** The headline a result view leads with; the percentage sits under it. */
export function accuracyFeedback(
  accuracy: number,
  { exact }: { exact: boolean },
): AccuracyFeedback {
  const band = accuracyBand(accuracy, exact);
  const { lead, rest, emoji } = COPY[band];
  return {
    band,
    lead,
    rest,
    headline: rest ? `${lead} ${rest}` : lead,
    emoji,
  };
}
