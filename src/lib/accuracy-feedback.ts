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
  /** Leads the result banner; only a word-for-word recall gets the party. */
  emoji: string;
}

const COPY: Record<
  AccuracyBand,
  { lead: string; rest: string; emoji: string }
> = {
  exact: { lead: "Word for word.", rest: "", emoji: "🎉" },
  nearly: {
    lead: "Nearly there.",
    rest: "Just a little to tidy up.",
    emoji: "🙌",
  },
  progress: {
    lead: "Good progress.",
    rest: "The highlighted words are worth another look.",
    emoji: "🌱",
  },
  again: {
    lead: "This one needs another pass.",
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
  if (accuracy >= LEARN_PROGRESS_ACCURACY) return "nearly";
  if (accuracy >= REVIEW_LAPSE_ACCURACY) return "progress";
  return "again";
}

/** The headline a result view leads with; the percentage sits under it. */
export function accuracyFeedback(
  accuracy: number,
  { exact, scheduleHeld = false }: { exact: boolean; scheduleHeld?: boolean },
): AccuracyFeedback {
  const band = accuracyBand(accuracy, exact);
  const { lead, emoji } = COPY[band];
  const rest =
    band === "again" && scheduleHeld
      ? "Another look will help it stick."
      : COPY[band].rest;
  return {
    band,
    lead,
    rest,
    headline: rest ? `${lead} ${rest}` : lead,
    emoji,
  };
}
