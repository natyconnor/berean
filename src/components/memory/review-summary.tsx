import type { JSX } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewSummaryProps {
  /** Verses that made progress this session (cleared or stepped up a stage). */
  reviewed: number;
  /** Verses that left today's due queue (rescheduled into the future). */
  cleared: number;
  /** Verses that advanced at least one learn stage but are still due. */
  stageUps: number;
  /** Verses still due right now (0 == fully caught up). */
  remaining: number;
  onDone: () => void;
  /** Offered only when there is still due work to keep going on. */
  onContinue?: () => void;
}

/**
 * End-of-queue card shown after a Review run: what got reviewed, what
 * cleared, stage-ups earned, and whether the learner is fully caught up.
 */
export function ReviewSummary({
  reviewed,
  cleared,
  stageUps,
  remaining,
  onDone,
  onContinue,
}: ReviewSummaryProps): JSX.Element {
  const caughtUp = remaining === 0;

  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader className="items-center gap-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {caughtUp ? (
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
          )}
        </div>
        <CardTitle className="text-2xl tracking-tight">
          {caughtUp ? "All caught up!" : "Review complete"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {caughtUp
            ? "You've cleared today's review queue."
            : `${remaining} verse${remaining !== 1 ? "s" : ""} still due today.`}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Reviewed" value={reviewed} />
          <Stat label="Cleared" value={cleared} />
          <Stat label="Stage-ups" value={stageUps} />
        </div>

        <div className="flex flex-col gap-2">
          {!caughtUp && onContinue && (
            <Button onClick={onContinue} className="w-full gap-2">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Keep reviewing
            </Button>
          )}
          <Button
            variant={caughtUp || !onContinue ? "default" : "outline"}
            onClick={onDone}
            className="w-full"
          >
            Back to memory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-lg border bg-card/60 px-3 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
