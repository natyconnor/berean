import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useDesktopUpdateState } from "@/hooks/use-desktop-update-state";
import { cn } from "@/lib/utils";
import {
  hasUnsavedNotes,
  hasUnsavedNotesInAnyWindow,
  requestDiscardUnsavedNotes,
} from "@/lib/unsaved-notes";
import {
  maybeRestoreDot,
  readDotDismissed,
  subscribeToDotDismissed,
  syncDotDismissedAcrossWindows,
  type ReadyUpdate,
} from "@/lib/update-dot";

/** A new web build is live; `refresh` reloads this window onto it. */
export type WebUpdate = { buildId: string; refresh: () => void };

function updateCopy(shellVersion: string | null) {
  // One restart covers a web build too, so a shell update always wins.
  return shellVersion !== null
    ? {
        line: `Berean ${shellVersion} is ready`,
        action: "Restart to update",
        pendingAction: "Restarting…",
        ariaLabel: `Update ready, Berean ${shellVersion}`,
      }
    : {
        line: "A new version of Berean is ready",
        action: "Refresh to update",
        pendingAction: "Refreshing…",
        ariaLabel: "Update ready",
      };
}

/**
 * The desktop app's "update ready" arrow, for a downloaded shell update, a
 * new web build, or both. Renders nothing until one is ready.
 */
export function UpdateIndicator({
  webUpdate,
}: {
  webUpdate: WebUpdate | null;
}) {
  const shellUpdate = useDesktopUpdateState();
  const [dismissed, setDismissed] = useState(readDotDismissed);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeToDotDismissed(setDismissed), []);

  const ready: ReadyUpdate = {
    shellVersion: shellUpdate?.readyVersion ?? null,
    webBuildId: webUpdate?.buildId ?? null,
  };
  if (ready.shellVersion === null && ready.webBuildId === null) return null;

  const isRestart = ready.shellVersion !== null;
  const copy = updateCopy(ready.shellVersion);
  const showDot = maybeRestoreDot(ready, dismissed);

  // Not now, Escape and clicking outside all land here.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) return;
    setDismissed(ready);
    syncDotDismissedAcrossWindows(ready);
  };

  const handleUpdate = async () => {
    // Pending from the first click: repeat clicks while it asks are ignored.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    // A restart quits every window; a refresh reloads only this one.
    const askFirst = isRestart
      ? await hasUnsavedNotesInAnyWindow()
      : hasUnsavedNotes();
    if (askFirst) {
      setOpen(false);
      if (!(await requestDiscardUnsavedNotes())) {
        pendingRef.current = false;
        setPending(false);
        return;
      }
    }
    setOpen(false);
    if (isRestart) {
      window.bereanDesktop?.installUpdate?.();
    } else {
      webUpdate?.refresh();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <TooltipButton
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-90 motion-safe:duration-150"
          tooltip={copy.line}
          aria-label={copy.ariaLabel}
          disabled={pending}
        >
          <ArrowUp className="h-4 w-4" />
          <span
            aria-hidden
            data-testid="update-dot"
            data-visible={showDot}
            className={cn(
              "pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background transition-opacity duration-150 motion-reduce:transition-none",
              !showDot && "opacity-0",
            )}
          />
        </TooltipButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 p-3"
        data-passage-dismiss-exempt
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          primaryRef.current?.focus();
        }}
      >
        <p className="text-sm font-medium">{copy.line}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            ref={primaryRef}
            size="sm"
            disabled={pending}
            onClick={() => void handleUpdate()}
          >
            {pending ? copy.pendingAction : copy.action}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
