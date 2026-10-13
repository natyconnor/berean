import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoreHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:focus-visible:opacity-100";

/** × (on hover or focus with a mouse) and ⋯ with Move up / Move down / Remove. */
export function RowEditControls({
  label,
  index,
  count,
  removing = false,
  onMove,
  onRemove,
}: {
  /** The row's reference, for accessible names. */
  label: string;
  index: number;
  count: number;
  removing?: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
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
      >
        <X aria-hidden />
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Options for ${label}`}
            className={cn(
              "size-11 text-muted-foreground sm:size-8 data-[state=open]:opacity-100",
              revealOnRowHover,
            )}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={removing}
            onSelect={onRemove}
          >
            <X aria-hidden />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
