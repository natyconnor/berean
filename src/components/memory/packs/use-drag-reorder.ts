import { useState, type DragEvent } from "react";

import { dropTargetIndex } from "@/lib/pack-order";
import { cn } from "@/lib/utils";

type DragState = { from: number; gap: number | null };

export interface DragRowState {
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
}

export interface DragReorder {
  handleProps: (index: number) => {
    draggable: true;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
  rowProps: (index: number) => {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  rowState: (index: number, count: number) => DragRowState;
}

/**
 * Native HTML5 drag and drop between the `<li>` rows of an ordered list:
 * spread `handleProps` on the grip and `rowProps` on each row. `onMove` runs
 * on drop. Keyboard and touch reorder through the row menu instead.
 */
export function useDragReorder(
  onMove: (from: number, to: number) => void,
): DragReorder {
  const [drag, setDrag] = useState<DragState | null>(null);
  const gap =
    drag && drag.gap !== null && dropTargetIndex(drag.from, drag.gap) !== null
      ? drag.gap
      : null;

  return {
    handleProps: (index) => ({
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = "move";
        // Firefox only starts a drag that carries data.
        event.dataTransfer.setData("text/plain", String(index));
        const row = event.currentTarget.closest("li");
        if (row) event.dataTransfer.setDragImage(row, 20, 20);
        setDrag({ from: index, gap: null });
      },
      onDragEnd: () => setDrag(null),
    }),
    rowProps: (index) => ({
      onDragOver: (event) => {
        if (!drag) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        const next =
          event.clientY > rect.top + rect.height / 2 ? index + 1 : index;
        if (next !== drag.gap) setDrag({ from: drag.from, gap: next });
      },
      onDrop: (event) => {
        if (!drag) return;
        event.preventDefault();
        const to =
          drag.gap === null ? null : dropTargetIndex(drag.from, drag.gap);
        setDrag(null);
        if (to !== null) onMove(drag.from, to);
      },
    }),
    rowState: (index, count) => ({
      dragging: drag?.from === index,
      dropBefore: gap === index,
      dropAfter: gap === count && index === count - 1,
    }),
  };
}

/** A drop line where the row would land, and a dimmed source row. */
export function dragRowClassName(state: DragRowState): string {
  return cn(
    state.dragging && "opacity-50",
    state.dropBefore && "shadow-[inset_0_2px_0_var(--color-primary)]",
    state.dropAfter && "shadow-[inset_0_-2px_0_var(--color-primary)]",
  );
}

/** "Moved Joshua 1:9 to 3 of 9." for the list's live region. */
export function moveAnnouncement(
  label: string,
  to: number,
  count: number,
): string {
  return `Moved ${label} to ${to + 1} of ${count}.`;
}
