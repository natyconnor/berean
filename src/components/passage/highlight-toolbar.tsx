import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS } from "@/lib/highlight-colors";
import {
  getSelectionOffsets,
} from "@/lib/highlight-utils";
import type { VerseRef } from "@/lib/verse-ref-utils";

export interface HighlightToolbarHandle {
  refreshPosition: () => void;
}

interface HighlightToolbarProps {
  verseTextRef: React.RefObject<HTMLSpanElement | null>;
  verseNumber: number;
  verseText: string;
  verseRef: VerseRef;
  onHighlight: (startOffset: number, endOffset: number, color: string) => void;
  onQuote: (text: string, verseRef: VerseRef) => void;
}

interface ToolbarPosition {
  top: number;
  left: number;
  showAbove: boolean;
}

export function HighlightToolbar({
  verseTextRef,
  verseNumber,
  verseText,
  verseRef,
  onHighlight,
  onQuote,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [selectedText, setSelectedText] = useState("");
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
      setSelectedText("");
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
    setSelectedText(verseText.slice(offsets.start, offsets.end));
    setSelectionOffsets(offsets);
  }, [verseTextRef, verseText]);

  useEffect(() => {
    const handleSelectionChange = () => {
      updatePosition();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [updatePosition]);

  useEffect(() => {
    const el = verseTextRef.current;
    if (!el) return;
    const handleMouseUp = () => {
      setTimeout(updatePosition, 10);
    };
    el.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mouseup", handleMouseUp);
    };
  }, [verseTextRef, updatePosition]);

  const handleColorClick = useCallback(
    (colorId: string) => {
      if (!selectionOffsets) return;
      onHighlight(selectionOffsets.start, selectionOffsets.end, colorId);
      window.getSelection()?.removeAllRanges();
      setPosition(null);
    },
    [selectionOffsets, onHighlight],
  );

  const handleQuoteClick = useCallback(() => {
    if (!selectedText) return;
    onQuote(selectedText, verseRef);
    window.getSelection()?.removeAllRanges();
    setPosition(null);
  }, [selectedText, verseRef, onQuote]);

  if (!position || !selectionOffsets) return null;

  return createPortal(
    <div
      ref={toolbarRef}
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
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        type="button"
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Quote in note"
        onClick={handleQuoteClick}
      >
        <Quote className="h-3.5 w-3.5" />
        Quote
      </button>
    </div>,
    document.body,
  );
}
