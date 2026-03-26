import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { logInteraction } from "@/lib/dev-log";

const CONFIRM_PHRASE = "i understand";

function matchesConfirmation(input: string): boolean {
  return input.trim().toLowerCase() === CONFIRM_PHRASE;
}

export function DeleteAccountSection() {
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = matchesConfirmation(confirmText);

  const resetAndClose = useCallback(() => {
    setOpen(false);
    setConfirmText("");
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        logInteraction("account", "delete-dialog-closed");
        resetAndClose();
        return;
      }
      logInteraction("account", "delete-dialog-opened");
      setOpen(true);
    },
    [resetAndClose],
  );

  const handleDelete = useCallback(async () => {
    if (!canSubmit || busy) return;
    logInteraction("account", "delete-started");
    setBusy(true);
    try {
      await deleteMyAccount({});
      try {
        await signOut();
      } catch {
        // Session is already removed server-side; still clear client state when possible.
      }
      resetAndClose();
      logInteraction("account", "delete-completed");
      await navigate({ to: "/" });
    } catch (error) {
      logInteraction("account", "delete-failed", {
        message: error instanceof Error ? error.message : "unknown-error",
      });
      throw error;
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canSubmit,
    deleteMyAccount,
    navigate,
    resetAndClose,
    signOut,
  ]);

  return (
    <>
      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-destructive">
            Delete account
          </h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account, Google sign-in link, and all notes,
            tags, highlights, and settings. This cannot be undone.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => {
            logInteraction("account", "delete-dialog-opened");
            setOpen(true);
          }}
          disabled={busy}
        >
          Delete my account…
        </Button>
      </section>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This removes your profile, OAuth connection, and every note, tag,
              link, highlight, and setting tied to this account. You will be
              signed out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <label
              htmlFor="delete-account-confirm"
              className="text-sm font-medium leading-none"
            >
              Type{" "}
              <span className="font-mono text-foreground">{CONFIRM_PHRASE}</span>{" "}
              to confirm
            </label>
            <Input
              id="delete-account-confirm"
              name="delete-account-confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              placeholder={CONFIRM_PHRASE}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={!canSubmit || busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
