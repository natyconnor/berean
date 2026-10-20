import type { ComponentProps, SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

const DISMISS_EXEMPT = { "data-passage-dismiss-exempt": "" };

/**
 * Reader hearts render their confirm inside verse rows. The dialog is
 * portaled, but React events still bubble to that row, where a mousedown
 * starts a verse selection, and native clicks reach the reader's click-away
 * handler, which would clear the selection behind the dialog.
 */
function ReaderConfirmContent(props: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      showCloseButton={false}
      {...DISMISS_EXEMPT}
      overlayProps={{ ...DISMISS_EXEMPT, onMouseDown: stopPropagation }}
      onMouseDown={stopPropagation}
      onMouseUp={stopPropagation}
      onClick={stopPropagation}
      {...props}
    />
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Asks before unhearting something the user is memorizing: unhearting also
 * stops it (the server enforces this either way).
 */
export function UnheartMemorizingDialog({
  open,
  onOpenChange,
  onConfirm,
  reference,
}: ConfirmDialogProps & {
  /** "Psalm 1:5", "Psalm 16". */
  reference: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ReaderConfirmContent role="alertdialog" className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Unheart {reference}?</DialogTitle>
          <DialogDescription>
            Unhearting also stops memorizing it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Keep
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Unheart and stop
          </Button>
        </DialogFooter>
      </ReaderConfirmContent>
    </Dialog>
  );
}
