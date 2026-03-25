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
}

export function PassageViewDialogs({
  showDiscardConfirmation,
  cancelDiscard,
  confirmDiscard,
}: PassageViewDialogsProps) {
  return (
    <Dialog
      open={showDiscardConfirmation}
      onOpenChange={(open) => {
        if (!open) cancelDiscard();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Discard unsaved notes?</DialogTitle>
          <DialogDescription>
            You have unsaved content in one or more note editors. Are you sure
            you want to discard your changes?
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
