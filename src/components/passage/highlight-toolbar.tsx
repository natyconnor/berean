import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS } from "@/lib/highlight-colors";
import {
  getSelectionOffsets,
} from "@/lib/highlight-utils";

export interface HighlightToolbarHandle {
  refreshPosition: () => void;
}

interface HighlightToolbarProps {
  verseTextRef: React.RefObject<HTMLSpanElement | null>;
  onHighlight: (startOffset: number, endOffset: number, color: string) => void;
}

interface ToolbarPosition {
  top: number;
  left: number;
  showAbove: boolean;
}

export function HighlightToolbar({
  verseTextRef,
  onHighlight,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  /** Avoid portaling/updating toolbar DOM while extending selection (see docs/fix-verse-text-selection-glitch.md Phase A). */
  const isPrimaryPointerDownRef = useRef(false);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [selectionOffsets, setSelectionOffsets] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const el = verseTextRef.current;
    if (!el) {
      setPosition(null);
      return;
    }

    const offsets = getSelectionOffsets(el);
    if (!offsets) {
      setPosition(null);
      setSelectionOffsets(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const showAbove = rect.top > 80;
    setPosition({
      left: rect.left + rect.width / 2,
      top: showAbove ? rect.top : rect.bottom,
      showAbove,
    });
    setSelectionOffsets(offsets);
  }, [verseTextRef]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (isPrimaryPointerDownRef.current) return;
      updatePosition();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [updatePosition]);

  useEffect(() => {
    const scheduleUpdateAfterRelease = () => {
      setTimeout(updatePosition, 10);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        isPrimaryPointerDownRef.current = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isPrimaryPointerDownRef.current = false;
      scheduleUpdateAfterRelease();
    };

    const onPointerCancel = () => {
      isPrimaryPointerDownRef.current = false;
      scheduleUpdateAfterRelease();
    };

    const opts = { capture: true };
    document.addEventListener("pointerdown", onPointerDown, opts);
    document.addEventListener("pointerup", onPointerUp, opts);
    document.addEventListener("pointercancel", onPointerCancel, opts);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, opts);
      document.removeEventListener("pointerup", onPointerUp, opts);
      document.removeEventListener("pointercancel", onPointerCancel, opts);
    };
  }, [updatePosition]);

  const handleColorClick = useCallback(
    (colorId: string) => {
      if (!selectionOffsets) return;
      onHighlight(selectionOffsets.start, selectionOffsets.end, colorId);
      window.getSelection()?.removeAllRanges();
      setPosition(null);
    },
    [selectionOffsets, onHighlight],
  );

  if (!position || !selectionOffsets) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      data-highlight-toolbar
      className={cn(
        "fixed z-100 flex items-center gap-1 rounded-lg border bg-popover px-2 py-1.5 shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{
        left: position.left,
        top: position.showAbove ? position.top - 8 : position.top + 8,
        transform: position.showAbove
          ? "translate(-50%, -100%)"
          : "translate(-50%, 0)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          className="h-6 w-6 rounded-full border border-border/50 transition-transform hover:scale-110 hover:ring-2 hover:ring-ring/30"
          style={{ backgroundColor: color.swatch }}
          title={`Highlight ${color.label}`}
          onClick={() => handleColorClick(color.id)}
        />
      ))}
    </div>,
    document.body,
  );
}
