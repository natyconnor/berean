import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteStudySessionDialogProps {
  /** When non-null, the dialog is open and targets this session. */
  candidate: { id: string; title: string } | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteStudySessionDialog({
  candidate,
  busy,
  onOpenChange,
  onCancel,
  onConfirm,
}: DeleteStudySessionDialogProps) {
  return (
    <Dialog open={candidate !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete study session?</DialogTitle>
          <DialogDescription>
            {candidate
              ? `"${candidate.title}" will be removed from your study sessions. Your hearted verses and notes are not affected. This action cannot be undone.`
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={candidate === null || busy}
          >
            Delete session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
