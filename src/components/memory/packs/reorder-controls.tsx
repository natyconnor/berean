import type { KeyboardEvent, ReactNode } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { DragReorder } from "./use-drag-reorder";

const REMOVE_TOOLTIP = "Remove from pack";

/**
 * Editing controls for an ordered verse list (a pack's verses, New pack's
 * "In this pack"). Rows are `group` list items.
 */

export function DragHandle({
  label,
  picked,
  onToggle,
  onMovePicked,
  onCancel,
  ...props
}: ReturnType<DragReorder["handleProps"]> & {
  label: string;
  picked: boolean;
  onToggle: () => void;
  onMovePicked: (delta: number) => void;
  onCancel: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onMovePicked(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onMovePicked(1);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <button
      type="button"
      {...props}
      aria-label={`Reorder ${label}`}
      aria-pressed={picked}
      title={`Reorder ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={onKeyDown}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-muted-foreground active:cursor-grabbing sm:size-8",
        "cursor-grab pointer-fine:size-8",
        picked && "text-foreground",
      )}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

const revealOnRowHover =
  "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:focus-visible:opacity-100";

export function RemoveFromPackButton({
  label,
  removing = false,
  onRemove,
}: {
  label: string;
  removing?: boolean;
  onRemove: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${label} from pack`}
          disabled={removing}
          onClick={onRemove}
          className={cn(
            "size-11 text-muted-foreground sm:size-8",
            "pointer-fine:size-8",
            revealOnRowHover,
          )}
        >
          <Trash2 aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{REMOVE_TOOLTIP}</TooltipContent>
    </Tooltip>
  );
}

/** Hover/focus trash on desktop, always-on on phones. Optional ⋯ slot. */
export function RowEditControls({
  label,
  removing = false,
  onRemove,
  menu,
}: {
  label: string;
  removing?: boolean;
  onRemove: () => void;
  menu?: ReactNode;
}) {
  return (
    <div
      className="flex shrink-0 items-center"
      onClick={(event) => event.stopPropagation()}
    >
      <RemoveFromPackButton
        label={label}
        removing={removing}
        onRemove={onRemove}
      />
      {menu}
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
