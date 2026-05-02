import { type ReactNode, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { FeatureHintState } from "./use-feature-hint";

interface FeatureInfoDialogProps {
  state: FeatureHintState;
  title: ReactNode;
  description: ReactNode;
  body?: ReactNode;
  /**
   * Label for the dismissal button. Defaults to "Got it" since these dialogs
   * exist purely to inform; there is no required follow-up action.
   */
  dismissLabel?: string;
}

/**
 * One-time explanation dialog used by Wave 3 (Study) and Wave 4 (Search) to
 * give the user a quick orientation the first time they open a feature.
 */
export function FeatureInfoDialog({
  state,
  title,
  description,
  body,
  dismissLabel = "Got it",
}: FeatureInfoDialogProps) {
  const open = state.pending;

  useEffect(() => {
    if (!open) return;
    if (state.shown) return;
    state.markShown();
  }, [open, state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) state.complete();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body ? <div className="text-sm text-foreground">{body}</div> : null}
        <DialogFooter>
          <Button onClick={() => state.complete()}>{dismissLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
