import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";

import { dropTargetIndex } from "@/lib/pack-order";
import { cn } from "@/lib/utils";

type PointerDrag = { mode: "pointer"; from: number; gap: number | null };
type KeyboardDrag = { mode: "keyboard"; from: number; to: number };
type DragState = PointerDrag | KeyboardDrag;

export interface DragRowState {
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
}

export interface DragReorder {
  handleProps: (
    index: number,
    label: string,
  ) => {
    draggable: true;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    "aria-pressed": boolean;
  };
  rowProps: (index: number) => {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  rowState: (index: number, count: number) => DragRowState;
  liveMessage: string;
}

/**
 * Native HTML5 drag and drop between the `<li>` rows of an ordered list:
 * spread `handleProps` on the grip and `rowProps` on each row. `onMove` runs
 * on drop. The grip is also a keyboard "Reorder" button: Space/Enter picks up
 * and drops, arrows move, Escape cancels.
 */
export function useDragReorder(
  onMove: (from: number, to: number) => void,
  count: number,
): DragReorder {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const pointerGap =
    drag?.mode === "pointer" &&
    drag.gap !== null &&
    dropTargetIndex(drag.from, drag.gap) !== null
      ? drag.gap
      : null;

  useEffect(() => {
    if (drag?.mode !== "keyboard") return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrag(null);
      setLiveMessage("Reorder cancelled.");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag]);

  return {
    liveMessage,
    handleProps: (index, label) => ({
      draggable: true,
      "aria-pressed": drag?.mode === "keyboard" && drag.from === index,
      onDragStart: (event) => {
        if (drag?.mode === "keyboard") {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        // Firefox only starts a drag that carries data.
        event.dataTransfer.setData("text/plain", String(index));
        const row = event.currentTarget.closest("li");
        if (row) event.dataTransfer.setDragImage(row, 20, 20);
        setDrag({ mode: "pointer", from: index, gap: null });
        setLiveMessage("");
      },
      onDragEnd: () => {
        setDrag((current) => (current?.mode === "keyboard" ? current : null));
      },
      onKeyDown: (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (drag?.mode === "keyboard") {
            if (drag.from !== index) return;
            const { from, to } = drag;
            setDrag(null);
            setLiveMessage("");
            if (to !== from) onMove(from, to);
            return;
          }
          setDrag({ mode: "keyboard", from: index, to: index });
          setLiveMessage(
            `Picked up ${label}. Position ${index + 1} of ${count}. Use arrow keys to move, Space or Enter to drop, Escape to cancel.`,
          );
          return;
        }
        if (drag?.mode !== "keyboard" || drag.from !== index) return;
        if (event.key === "Escape") {
          event.preventDefault();
          setDrag(null);
          setLiveMessage("Reorder cancelled.");
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const delta = event.key === "ArrowUp" ? -1 : 1;
          const to = Math.min(count - 1, Math.max(0, drag.to + delta));
          setDrag({ ...drag, to });
          setLiveMessage(`Position ${to + 1} of ${count}.`);
        }
      },
    }),
    rowProps: (index) => ({
      onDragOver: (event) => {
        if (drag?.mode !== "pointer") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        const next =
          event.clientY > rect.top + rect.height / 2 ? index + 1 : index;
        if (next !== drag.gap) {
          setDrag({ mode: "pointer", from: drag.from, gap: next });
        }
      },
      onDrop: (event) => {
        if (drag?.mode !== "pointer") return;
        event.preventDefault();
        const to =
          drag.gap === null ? null : dropTargetIndex(drag.from, drag.gap);
        setDrag(null);
        if (to !== null) onMove(drag.from, to);
      },
    }),
    rowState: (index, rowCount) => ({
      dragging: drag?.from === index,
      dropBefore:
        pointerGap === index ||
        (drag?.mode === "keyboard" &&
          drag.to !== drag.from &&
          drag.to < drag.from &&
          index === drag.to),
      dropAfter:
        (pointerGap === rowCount && index === rowCount - 1) ||
        (drag?.mode === "keyboard" &&
          drag.to !== drag.from &&
          drag.to > drag.from &&
          index === drag.to),
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
