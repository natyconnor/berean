import { type RefObject, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoreHorizontal,
  X,
} from "lucide-react";

import {
  RefreshMenuItem,
  StartOverConfirm,
  StartOverMenuItem,
} from "@/components/memory/memory-restart-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PopoverAnchor } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { DragReorder } from "./use-drag-reorder";

/**
 * Editing controls for an ordered verse list (a pack's verses, New pack's
 * "In this pack"). Rows are `group` list items.
 */

/** Mouse-only grip; keyboard and touch use the row menu instead. */
export function DragHandle(props: ReturnType<DragReorder["handleProps"]>) {
  return (
    <span
      {...props}
      aria-hidden
      title="Drag to reorder"
      className="hidden shrink-0 cursor-grab items-center text-muted-foreground/60 transition-colors hover:text-muted-foreground active:cursor-grabbing pointer-fine:flex"
    >
      <GripVertical className="size-4" />
    </span>
  );
}

const revealOnRowHover =
  "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-[state=open]:opacity-100 pointer-fine:data-[confirm-open]:opacity-100";

export type RowStartOver = {
  show: boolean;
  pending: boolean;
  confirmOpen: boolean;
  error: string | null;
  title: string;
  body: string;
  onSelect: () => void;
  onConfirm: () => void;
  onConfirmOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

/** ••• Refresh on a Memorized row. */
export type RowRefresh = {
  pending: boolean;
  onSelect: () => void;
};

/**
 * × (on hover or focus with a mouse) and ⋯ with Move / Refresh / Start over /
 * Remove.
 */
export function RowEditControls({
  label,
  index,
  count,
  removing = false,
  onMove,
  onRemove,
  startOver,
  refresh,
}: {
  /** The row's reference, for accessible names. */
  label: string;
  index?: number;
  count?: number;
  removing?: boolean;
  onMove?: (from: number, to: number) => void;
  onRemove?: () => void;
  startOver?: RowStartOver;
  refresh?: RowRefresh;
}) {
  const pendingConfirm = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerLabel = `Options for ${label}`;
  const editable =
    onMove !== undefined &&
    onRemove !== undefined &&
    index !== undefined &&
    count !== undefined;
  const showStartOver = startOver?.show === true;
  const showMemoryActions = showStartOver || refresh !== undefined;
  const confirmOpenProps =
    startOver?.confirmOpen === true ? { "data-confirm-open": "" as const } : {};

  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button
        ref={startOver?.triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={triggerLabel}
        loading={refresh?.pending}
        className={cn(
          "size-11 text-muted-foreground sm:size-8",
          revealOnRowHover,
        )}
        {...confirmOpenProps}
      >
        {refresh?.pending ? null : <MoreHorizontal aria-hidden />}
      </Button>
    </DropdownMenuTrigger>
  );

  const menu = (
    <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
      {startOver ? <PopoverAnchor asChild>{trigger}</PopoverAnchor> : trigger}
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (!pendingConfirm.current) return;
          event.preventDefault();
          pendingConfirm.current = false;
          startOver?.onConfirmOpenChange(true);
        }}
      >
        {editable ? (
          <>
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => onMove(index, index - 1)}
            >
              <ArrowUp aria-hidden />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index >= count - 1}
              onSelect={() => onMove(index, index + 1)}
            >
              <ArrowDown aria-hidden />
              Move down
            </DropdownMenuItem>
          </>
        ) : null}
        {editable && showMemoryActions ? <DropdownMenuSeparator /> : null}
        {refresh ? <RefreshMenuItem onSelect={refresh.onSelect} /> : null}
        {showStartOver && startOver ? (
          <StartOverMenuItem
            disabled={startOver.pending}
            onSelect={() => {
              pendingConfirm.current = true;
              startOver.onSelect();
              setMenuOpen(false);
            }}
          />
        ) : null}
        {editable ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={removing}
              onSelect={onRemove}
            >
              <X aria-hidden />
              Remove
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex shrink-0 items-center">
      {editable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${label}`}
          disabled={removing}
          onClick={onRemove}
          className={cn(
            "hidden size-8 text-muted-foreground pointer-fine:inline-flex",
            revealOnRowHover,
          )}
          {...confirmOpenProps}
        >
          <X aria-hidden />
        </Button>
      ) : null}
      {startOver ? (
        <StartOverConfirm
          open={startOver.confirmOpen}
          onOpenChange={startOver.onConfirmOpenChange}
          pending={startOver.pending}
          title={startOver.title}
          body={startOver.body}
          error={startOver.error}
          triggerLabel={triggerLabel}
          triggerRef={startOver.triggerRef}
          onConfirm={startOver.onConfirm}
        >
          {menu}
        </StartOverConfirm>
      ) : (
        menu
      )}
    </div>
  );
}

/** Polite live region that reads out moves. */
export function MoveAnnouncer({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
