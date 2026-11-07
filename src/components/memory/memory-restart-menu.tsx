import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Check,
  CircleStop,
  Lightbulb,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  useRefreshReturnFocus,
  useStartVerseRefresh,
} from "@/hooks/use-start-verse-refresh";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import {
  canStartOver,
  REFRESH_MENU_LABEL,
  START_OVER_CANCEL_LABEL,
  START_OVER_CONFIRM_BODY,
  START_OVER_CONFIRM_LABEL,
  START_OVER_ERROR,
  START_OVER_MENU_DETAIL,
  START_OVER_MENU_LABEL,
  STARTED_OVER_LABEL,
  startOverTitle,
} from "@/lib/memory-copy";
import {
  isDueForReview,
  isReviewPhase,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

const MORE_ACTIONS_LABEL = "More actions";

export function StartedOverStatus({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm",
        className,
      )}
    >
      <Check className="size-4 text-emerald-700" aria-hidden />
      <span className="font-semibold">{STARTED_OVER_LABEL}</span>
    </div>
  );
}

export function StartOverMenuItem({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <RotateCcw aria-hidden />
      <span className="flex flex-col">
        <span>{START_OVER_MENU_LABEL}</span>
        <span className="text-xs text-muted-foreground">
          {START_OVER_MENU_DETAIL}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

/** ••• Refresh: the two-step refresher on a Memorized verse. */
export function RefreshMenuItem({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={onSelect}>
      <Lightbulb aria-hidden />
      {REFRESH_MENU_LABEL}
    </DropdownMenuItem>
  );
}

/** The R34 line under the control that started a refresher. */
export function RefreshStartError({
  error,
  className,
}: {
  error: string | null;
  className?: string;
}) {
  if (!error) return null;
  return (
    <p role="alert" className={cn("text-xs text-destructive", className)}>
      {error}
    </p>
  );
}

export function StartOverConfirm({
  open,
  onOpenChange,
  pending,
  title,
  body,
  error,
  triggerLabel,
  triggerRef,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  title: string;
  body: string;
  error: string | null;
  triggerLabel: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      {children}
      <PopoverContent
        align="end"
        className="w-[min(21rem,calc(100vw-32px))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        onFocusOutside={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            (target.closest(`[aria-label="${triggerLabel}"]`) ||
              target.closest("[role='menu']"))
          ) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <h3 className="text-[15px] font-semibold tracking-tight text-pretty">
          {title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-5 text-foreground/80">
          {body}
        </p>
        <div className="mt-3.5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            ref={cancelRef}
            className="max-sm:h-11 max-sm:flex-1"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {START_OVER_CANCEL_LABEL}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="max-sm:h-11 max-sm:flex-1"
            loading={pending}
            onClick={onConfirm}
          >
            {START_OVER_CONFIRM_LABEL}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Verse page ••• menu: Refresh on a Memorized verse, Start over when there is
 * real progress, then Stop memorizing. Confirm is a popover on the same
 * button. No Undo.
 */
export function VerseMemoryMenu({
  verseRefId,
  reference,
  verse,
  status,
  dueAt,
  learnStage,
  stageReps,
  lastReviewedAt,
  returnTo,
  onStopped,
}: {
  verseRefId: Id<"verseRefs">;
  reference: string;
  verse: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  };
  status: MemoryStatus;
  dueAt: number;
  learnStage: number;
  stageReps?: number;
  lastReviewedAt?: number;
  /** Where the refresher's Continue comes back to. */
  returnTo: string;
  onStopped: () => void;
}) {
  const startOver = useMutation(api.verseMemory.startOver);
  const stopMemorizing = useMutation(api.verseMemory.stopMemorizing);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingConfirm = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingTriggerFocus = useRef(false);
  const startLock = useSubmitLock();
  const stopLock = useSubmitLock();
  const refresh = useStartVerseRefresh(verse, returnTo);
  const now = useLiveNow();
  useRefreshReturnFocus(verse, triggerRef);

  useLayoutEffect(() => {
    if (!pendingTriggerFocus.current) return;
    pendingTriggerFocus.current = false;
    triggerRef.current?.focus();
  });

  const showStartOver =
    !started && canStartOver({ status, learnStage, stageReps, lastReviewedAt });
  const showRefresh = !started && isReviewPhase(status);

  const handleStartOverSelect = () => {
    setError(null);
    pendingConfirm.current = true;
    setMenuOpen(false);
  };

  const handleConfirm = () =>
    startLock.submit(async () => {
      setError(null);
      try {
        await startOver({ verseRefId, now: Date.now() });
        setConfirmOpen(false);
        setStarted(true);
        pendingTriggerFocus.current = true;
      } catch {
        setError(START_OVER_ERROR);
      }
    });

  const handleStop = () =>
    stopLock.submit(async () => {
      try {
        await stopMemorizing({ verseRefId, now: Date.now() });
        setStopOpen(false);
        toast.success(`Stopped memorizing ${reference}.`);
        onStopped();
      } catch {
        toast.error("Couldn't stop memorizing. Please try again.");
      }
    });

  const setConfirmOpenSafe = (open: boolean) => {
    if (startLock.pending) return;
    setConfirmOpen(open);
    if (!open) setError(null);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {started ? <StartedOverStatus /> : null}
      <StartOverConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpenSafe}
        pending={startLock.pending}
        title={startOverTitle(reference)}
        body={START_OVER_CONFIRM_BODY}
        error={error}
        triggerLabel={MORE_ACTIONS_LABEL}
        triggerRef={triggerRef}
        onConfirm={handleConfirm}
      >
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverAnchor asChild>
            <DropdownMenuTrigger asChild>
              <Button
                ref={triggerRef}
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground sm:size-8"
                aria-label={MORE_ACTIONS_LABEL}
                disabled={startLock.pending}
                loading={refresh.pending}
              >
                {refresh.pending ? null : <MoreHorizontal aria-hidden />}
              </Button>
            </DropdownMenuTrigger>
          </PopoverAnchor>
          <DropdownMenuContent
            align="end"
            className="max-w-[min(18rem,calc(100vw-32px))]"
            onCloseAutoFocus={(event) => {
              if (!pendingConfirm.current) return;
              event.preventDefault();
              pendingConfirm.current = false;
              setConfirmOpen(true);
            }}
          >
            {showRefresh ? (
              <RefreshMenuItem
                disabled={startLock.pending}
                onSelect={() =>
                  refresh.start(isDueForReview({ status, dueAt }, now))
                }
              />
            ) : null}
            {showStartOver ? (
              <StartOverMenuItem
                disabled={startLock.pending}
                onSelect={handleStartOverSelect}
              />
            ) : null}
            {showRefresh || showStartOver ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant="destructive"
              disabled={startLock.pending}
              onSelect={() => setStopOpen(true)}
            >
              <CircleStop aria-hidden />
              Stop memorizing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </StartOverConfirm>
      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Stop memorizing {reference}?</DialogTitle>
            <DialogDescription>
              Your progress is saved if you start again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStopOpen(false)}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={stopLock.pending}
              onClick={handleStop}
            >
              Stop memorizing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RefreshStartError
        error={refresh.error}
        className="basis-full text-right"
      />
    </div>
  );
}
