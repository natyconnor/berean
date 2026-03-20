import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DeleteCustomTagDialogProps {
  deleteTagCandidate: string | null;
  busyAction: string | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteCustomTagDialog({
  deleteTagCandidate,
  busyAction,
  onOpenChange,
  onCancel,
  onConfirm,
}: DeleteCustomTagDialogProps) {
  return (
    <Dialog open={deleteTagCandidate !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete custom tag?</DialogTitle>
          <DialogDescription>
            {deleteTagCandidate
              ? `This will remove "${deleteTagCandidate}" from your custom tags and from any notes that use it. This action cannot be undone.`
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={busyAction !== null}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={deleteTagCandidate === null || busyAction !== null}
          >
            {deleteTagCandidate &&
              busyAction === `delete-custom:${deleteTagCandidate}` && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
            Delete tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
