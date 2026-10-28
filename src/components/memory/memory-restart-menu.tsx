import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { useSubmitLock } from "@/hooks/use-submit-lock";
import {
  FIRST_LETTERS_HINT_LABEL,
  NEED_A_REFRESHER_LABEL,
  REFRESH_LABEL,
  REFRESH_MENU_DETAIL,
  REFRESH_START_ERROR,
  START_OVER_CANCEL_LABEL,
  START_OVER_CONFIRM_BODY,
  START_OVER_CONFIRM_LABEL,
  START_OVER_ERROR,
  START_OVER_MENU_DETAIL,
  START_OVER_MENU_LABEL,
  STARTED_OVER_LABEL,
  UNDO_LABEL,
  UNDO_START_OVER_ERROR,
  WHOLE_PACK_OPTION,
  WHOLE_PASSAGE_OPTION,
  formatShakyVerseList,
  shakyVersesOption,
  startOverTitle,
} from "@/lib/memory-copy";
import { refreshEligibility, type RefreshTarget } from "@/lib/memory-way-back";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

export { FIRST_LETTERS_HINT_LABEL, NEED_A_REFRESHER_LABEL, REFRESH_LABEL };

type ShakyChoice = "shaky" | "whole";

export type MemoryRestartStop = {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  icon?: ReactNode;
};

export function MemoryRestartMenu({
  name,
  fullPageHref,
  isDrawer,
  refreshHref,
  refreshTarget,
  onRefresh,
  onStartOver,
  onUndo,
  stop,
  shakyLabels = [],
  wholeLabel,
  openStartOver = false,
  extraItems,
  showRestart = true,
  triggerLabel = "More actions",
}: {
  name: string;
  fullPageHref?: string;
  isDrawer: boolean;
  refreshHref: string;
  refreshTarget?: RefreshTarget;
  onRefresh?: () => Promise<void>;
  onStartOver?: (
    choice: ShakyChoice,
    opts?: { replaceUndo?: boolean },
  ) => Promise<void>;
  onUndo?: () => Promise<void>;
  stop?: MemoryRestartStop;
  shakyLabels?: readonly string[];
  wholeLabel?: "passage" | "pack";
  openStartOver?: boolean;
  extraItems?: ReactNode;
  showRestart?: boolean;
  triggerLabel?: string;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(openStartOver);
  const [stopOpen, setStopOpen] = useState(false);
  const [pickedChoice, setPickedChoice] = useState<ShakyChoice | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingConfirm = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingTriggerFocus = useRef(false);

  useLayoutEffect(() => {
    if (!pendingTriggerFocus.current) return;
    pendingTriggerFocus.current = false;
    triggerRef.current?.focus();
  });
  const choice: ShakyChoice =
    pickedChoice ?? (shakyLabels.length > 0 ? "shaky" : "whole");
  const startLock = useSubmitLock();
  const refreshLock = useSubmitLock();
  const undoLock = useSubmitLock();
  const stopLock = useSubmitLock();

  const openFullPage = (href: string) => {
    void navigate({ href });
  };

  const handleRefresh = () =>
    refreshLock.submit(async () => {
      setError(null);
      try {
        await onRefresh?.();
        openFullPage(refreshHref);
      } catch {
        setError(REFRESH_START_ERROR);
      }
    });

  const handleStartOverSelect = () => {
    if (isDrawer && fullPageHref) {
      const joiner = fullPageHref.includes("?") ? "&" : "?";
      openFullPage(`${fullPageHref}${joiner}startOver=1`);
      return;
    }
    setError(null);
    pendingConfirm.current = true;
    setMenuOpen(false);
  };

  const handleConfirm = () =>
    startLock.submit(async () => {
      setError(null);
      try {
        await onStartOver?.(shakyLabels.length > 0 ? choice : "whole", {
          replaceUndo: !started,
        });
        setConfirmOpen(false);
        setStarted(true);
      } catch {
        setError(START_OVER_ERROR);
      }
    });

  const handleUndo = () =>
    undoLock.submit(async () => {
      setError(null);
      try {
        await onUndo?.();
        pendingTriggerFocus.current = true;
        setStarted(false);
      } catch {
        setError(UNDO_START_OVER_ERROR);
      }
    });

  const showChooser = shakyLabels.length > 0 && wholeLabel !== undefined;
  const showRefresh =
    showRestart &&
    !started &&
    refreshTarget !== undefined &&
    refreshEligibility(refreshTarget) === "learned";
  const showMenu = Boolean(extraItems || stop || (showRestart && !started));
  if (!started && !showMenu) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {started ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
          <Check className="size-4 text-emerald-700" aria-hidden />
          <span className="font-semibold">{STARTED_OVER_LABEL}</span>
          <span aria-hidden className="text-muted-foreground">
            {" · "}
          </span>
          <button
            type="button"
            className="text-[12.5px] font-medium text-primary"
            onClick={handleUndo}
            disabled={undoLock.pending}
          >
            {UNDO_LABEL}
          </button>
          {error ? (
            <p className="w-full text-xs text-destructive">{error}</p>
          ) : null}
        </div>
      ) : null}
      {showMenu ? (
        <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DropdownMenu
            modal={false}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          >
            <PopoverAnchor asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={triggerRef}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground sm:size-8"
                  aria-label={triggerLabel}
                >
                  <MoreHorizontal aria-hidden />
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
                <DropdownMenuItem
                  disabled={refreshLock.pending || startLock.pending}
                  onSelect={(event) => {
                    event.preventDefault();
                    setMenuOpen(false);
                    void handleRefresh();
                  }}
                >
                  <Lightbulb aria-hidden />
                  <span className="flex flex-col">
                    <span>{REFRESH_LABEL}</span>
                    <span className="text-xs text-muted-foreground">
                      {REFRESH_MENU_DETAIL}
                    </span>
                  </span>
                </DropdownMenuItem>
              ) : null}
              {showRestart ? (
                <DropdownMenuItem
                  disabled={refreshLock.pending || startLock.pending}
                  onSelect={(event) => {
                    event.preventDefault();
                    handleStartOverSelect();
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
              ) : null}
              {extraItems}
              {stop && (showRestart || extraItems) ? (
                <DropdownMenuSeparator />
              ) : null}
              {stop ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={startLock.pending}
                  onSelect={() => setStopOpen(true)}
                >
                  {stop.icon ?? <CircleStop aria-hidden />}
                  {stop.label}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <PopoverContent
            align="end"
            className="w-[min(21rem,calc(100vw-32px))]"
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
          >
            <h3 className="text-[15px] font-semibold tracking-tight text-pretty">
              {startOverTitle(name)}
            </h3>
            {showChooser ? (
              <div className="mt-3 grid gap-2">
                <Choice
                  selected={choice === "shaky"}
                  onSelect={() => setPickedChoice("shaky")}
                  label={shakyVersesOption(formatShakyVerseList(shakyLabels))}
                />
                <Choice
                  selected={choice === "whole"}
                  onSelect={() => setPickedChoice("whole")}
                  label={
                    wholeLabel === "pack"
                      ? WHOLE_PACK_OPTION
                      : WHOLE_PASSAGE_OPTION
                  }
                />
              </div>
            ) : wholeLabel ? null : (
              <p className="mt-1.5 text-[13px] leading-5 text-foreground/80">
                {START_OVER_CONFIRM_BODY}
              </p>
            )}
            {error ? (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            ) : null}
            <div className="mt-3.5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                {START_OVER_CANCEL_LABEL}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={startLock.pending}
                onClick={handleConfirm}
              >
                {START_OVER_CONFIRM_LABEL}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {stop ? (
        <Dialog open={stopOpen} onOpenChange={setStopOpen}>
          <DialogContent showCloseButton={false} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{stop.title}</DialogTitle>
              <DialogDescription>{stop.description}</DialogDescription>
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
                onClick={() =>
                  stopLock.submit(async () => {
                    await stop.onConfirm();
                    setStopOpen(false);
                  })
                }
              >
                {stop.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function Choice({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left",
        selected
          ? "border-primary/45 bg-primary/5"
          : "border-border bg-background",
      )}
    >
      <span
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-full border-[1.5px]",
          selected ? "border-primary" : "border-foreground/35",
        )}
      >
        {selected ? (
          <span className="m-[3px] block size-2.5 rounded-full bg-primary" />
        ) : null}
      </span>
      <span className="text-[13.5px] font-semibold">{label}</span>
    </button>
  );
}

export function VerseRestartMenu({
  verseRefId,
  reference,
  status,
  learnStage,
  refreshHref,
  fullPageHref,
  isDrawer,
  openStartOver,
  onStopped,
}: {
  verseRefId: Id<"verseRefs">;
  reference: string;
  status: MemoryStatus;
  learnStage: number;
  refreshHref: string;
  fullPageHref?: string;
  isDrawer: boolean;
  openStartOver?: boolean;
  onStopped: () => void;
}) {
  const startOver = useMutation(api.verseMemory.startOver);
  const undoStartOver = useMutation(api.verseMemory.undoStartOver);
  const stopMemorizing = useMutation(api.verseMemory.stopMemorizing);

  return (
    <MemoryRestartMenu
      name={reference}
      fullPageHref={fullPageHref}
      isDrawer={isDrawer}
      refreshHref={refreshHref}
      refreshTarget={{ scope: "verse", mark: { status, learnStage } }}
      openStartOver={openStartOver}
      onStartOver={async (_choice, opts) => {
        await startOver({
          verseRefId,
          now: Date.now(),
          replaceUndo: opts?.replaceUndo,
        });
      }}
      onUndo={async () => {
        await undoStartOver({ verseRefId, now: Date.now() });
      }}
      stop={{
        label: "Stop memorizing",
        title: `Stop memorizing ${reference}?`,
        description: "Your progress is saved if you start again.",
        onConfirm: async () => {
          await stopMemorizing({ verseRefId, now: Date.now() });
          toast.success(`Stopped memorizing ${reference}.`);
          onStopped();
        },
      }}
    />
  );
}
