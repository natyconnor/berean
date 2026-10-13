import type { JSX } from "react";

import { accuracyFeedback, type AccuracyBand } from "@/lib/accuracy-feedback";
import { cn } from "@/lib/utils";

const LEAD_TONE: Record<AccuracyBand, string> = {
  exact: "text-emerald-700 dark:text-emerald-300",
  nearly: "text-emerald-700 dark:text-emerald-300",
  progress: "text-amber-700 dark:text-amber-300",
  again: "text-foreground",
};

/**
 * A checked attempt's headline ("Good progress. …") with the percentage as
 * quiet text under it, so no result leads with a bare number.
 */
export function AccuracyHeadline({
  accuracy,
  exact,
  note,
}: {
  accuracy: number;
  /** The grader's exact verdict, which forgives a stray typo. */
  exact: boolean;
  /** Trails the percentage, e.g. "Pass at 85%". */
  note?: string;
}): JSX.Element {
  const feedback = accuracyFeedback(accuracy, { exact });
  return (
    <div role="status" aria-live="polite" className="text-center">
      <p className="text-lg leading-snug text-balance">
        <span className={cn("font-semibold", LEAD_TONE[feedback.band])}>
          {feedback.lead}
        </span>
        {feedback.rest ? (
          <span className="text-foreground/80"> {feedback.rest}</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {`${accuracy}% recalled`}
        {note ? ` · ${note}` : null}
      </p>
    </div>
  );
}
