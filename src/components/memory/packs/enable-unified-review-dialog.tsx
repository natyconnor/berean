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
 * The one confirmation between a pack of separately-scheduled verses and a
 * single recitation.
 *
 * It names the trade the learner is actually making: the verses that aren't
 * due yet get pulled to today (which is what ends the "two due, two not"
 * drip), and from then on the pack comes back as one card on one schedule.
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
          <DialogTitle>Review {packName} together?</DialogTitle>
          <DialogDescription>
            Instead of reviewing each verse separately, you&apos;ll recite this
            pack as one passage, on one schedule.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <CalendarCheck
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            />
            <span>
              <span className="font-medium">All the verses move to today.</span>{" "}
              {notDueCount > 0
                ? `${notDueCount} of ${verseCount} verse${verseCount === 1 ? "" : "s"} ${notDueCount === 1 ? "isn't" : "aren't"} due yet, but ${notDueCount === 1 ? "it'll join" : "they'll join"} this review so the whole passage stays together.`
                : `All ${verseCount} verse${verseCount === 1 ? " is" : "s are"} already due.`}
            </span>
          </li>
          <li className="flex gap-3">
            <ScrollText
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            />
            <span>
              <span className="font-medium">One recitation, one grade.</span>{" "}
              Type the whole passage from memory (no verse numbers needed). Your
              grade sets the next review for every verse.
            </span>
          </li>
        </ul>

        <p className="text-xs text-muted-foreground">
          You can switch back to reviewing verse by verse anytime from the ⋯
          menu. You won&apos;t lose any progress.
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
