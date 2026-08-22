import { CalendarCheck, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EnableUnifiedReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packName: string;
  /** Members that would be recited together. */
  verseCount: number;
  /** Members not due yet — the ones enabling pulls forward to today. */
  notDueCount: number;
  isEnabling: boolean;
  error: string | null;
  onConfirm: () => void;
}

/**
 * The one confirmation between a pack of separately-scheduled units and a
 * single passage recitation.
 *
 * It names the trade the learner is actually making: the units that aren't due
 * yet get pulled to today (which is what ends the "two due, two not" drip), and
 * from then on the pack comes back as one card on one schedule.
 */
export function EnableUnifiedReviewDialog({
  open,
  onOpenChange,
  packName,
  verseCount,
  notDueCount,
  isEnabling,
  error,
  onConfirm,
}: EnableUnifiedReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recite {packName} as one passage?</DialogTitle>
          <DialogDescription>
            Reviews stop arriving a unit at a time. From now on this pack comes
            back as a single recitation on a single schedule.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <CalendarCheck
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            />
            <span>
              <span className="font-medium">Everything moves to today.</span>{" "}
              {notDueCount > 0
                ? `${notDueCount} of ${verseCount} unit${verseCount === 1 ? "" : "s"} ${notDueCount === 1 ? "isn't" : "aren't"} due yet — ${notDueCount === 1 ? "it joins" : "they join"} this review so the whole passage stays in step.`
                : `All ${verseCount} unit${verseCount === 1 ? "" : "s"} are already due, so nothing is left half-scheduled.`}
            </span>
          </li>
          <li className="flex gap-3">
            <ScrollText
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            />
            <span>
              <span className="font-medium">One card, one grade.</span> Type the
              whole passage — no verse numbers — and that grade sets the next
              review date for every unit at once.
            </span>
          </li>
        </ul>

        <p className="text-xs text-muted-foreground">
          You can switch back to unit-by-unit reviews any time. Nothing you have
          learned is reset.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isEnabling}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isEnabling}>
            {isEnabling ? "Turning on\u2026" : "Turn on and recite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
