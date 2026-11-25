import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PassageViewDialogsProps {
  showDiscardConfirmation: boolean;
  cancelDiscard: () => void;
  confirmDiscard: () => void;
  /**
   * Keeps clicks in the dialog from counting as a click away from an open
   * note. Set when it is shown from outside the passage view, so
   * Keep editing leaves the reader exactly as it was.
   */
  dismissExempt?: boolean;
}

export function PassageViewDialogs({
  showDiscardConfirmation,
  cancelDiscard,
  confirmDiscard,
  dismissExempt = false,
}: PassageViewDialogsProps) {
  const exempt: Record<string, string> = dismissExempt
    ? { "data-passage-dismiss-exempt": "" }
    : {};
  return (
    <Dialog
      open={showDiscardConfirmation}
      onOpenChange={(open) => {
        if (!open) cancelDiscard();
      }}
    >
      <DialogContent className="sm:max-w-md" {...exempt} overlayProps={exempt}>
        <DialogHeader>
          <DialogTitle>Discard unsaved notes?</DialogTitle>
          <DialogDescription>
            You have unsaved changes in your notes. Do you want to discard them?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={cancelDiscard}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={confirmDiscard}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
