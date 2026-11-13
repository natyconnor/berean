import {
  LEARN_PROGRESS_ACCURACY,
  REVIEW_LAPSE_ACCURACY,
} from "@/lib/memory-scheduler";

export type AccuracyBand = "exact" | "pass" | "close" | "miss";

/** Leads the result banner; only a perfect attempt gets the party. */
export const BAND_EMOJI: Record<AccuracyBand, string> = {
  exact: "🎉",
  pass: "🙌",
  close: "🌱",
  miss: "📖",
};

/**
 * The band a graded attempt falls in. `exact` is the grader's verdict (it
 * forgives a stray typo), so it wins over the raw percentage. Thresholds are
 * the scheduler's, so the color matches what the grade does.
 */
export function accuracyBand(accuracy: number, exact: boolean): AccuracyBand {
  if (exact) return "exact";
  if (accuracy >= LEARN_PROGRESS_ACCURACY) return "pass";
  if (accuracy >= REVIEW_LAPSE_ACCURACY) return "close";
  return "miss";
}
