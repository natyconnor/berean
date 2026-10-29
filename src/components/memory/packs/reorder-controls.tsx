import { GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { DragReorder } from "./use-drag-reorder";

export function DragHandle({
  label,
  ...props
}: ReturnType<DragReorder["handleProps"]> & { label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      {...props}
      data-keep-drawer-on-escape=""
      aria-label={`Reorder ${label}`}
      title="Drag to reorder"
      className="shrink-0 cursor-grab text-muted-foreground/60 transition-colors hover:text-muted-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </Button>
  );
}

export function RowEditControls({
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
          size="icon-sm"
          aria-label={`Remove ${label}`}
          disabled={removing}
          onClick={onRemove}
          className="hidden text-muted-foreground opacity-0 md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
        >
          <Trash2 aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Remove from pack</TooltipContent>
    </Tooltip>
  );
}

export function MoveAnnouncer({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
