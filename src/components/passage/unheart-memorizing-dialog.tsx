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

/** Asks before unhearting a range heart the user is not memorizing. */
export function UnheartPassageDialog({
  open,
  onOpenChange,
  onConfirm,
  startVerse,
  endVerse,
}: ConfirmDialogProps & { startVerse: number; endVerse: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ReaderConfirmContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Remove this passage?</DialogTitle>
          <DialogDescription>
            This will remove verses {startVerse}–{endVerse} from your hearted
            list. You can heart the passage again anytime from the reader.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Unheart passage
          </Button>
        </DialogFooter>
      </ReaderConfirmContent>
    </Dialog>
  );
}

/**
 * The confirm a hearted range asks for before unhearting: the memorizing one
 * when unhearting stops memorizing, the plain passage one otherwise.
 */
export function UnheartRangeDialog({
  stopsMemorizing,
  reference,
  ...props
}: ConfirmDialogProps & {
  stopsMemorizing: boolean;
  reference: string;
  startVerse: number;
  endVerse: number;
}) {
  return stopsMemorizing ? (
    <UnheartMemorizingDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      onConfirm={props.onConfirm}
      reference={reference}
    />
  ) : (
    <UnheartPassageDialog {...props} />
  );
}
