import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS } from "@/lib/highlight-colors";

interface HighlightMarkPopoverProps {
  anchorRect: DOMRect;
  highlightId: string;
  currentColor: string;
  onDelete: () => void;
  onRecolor: (color: string) => void;
  onClose: () => void;
}

const POPOVER_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 26,
  mass: 0.8,
};

export function HighlightMarkPopover({
  anchorRect,
  currentColor,
  onDelete,
  onRecolor,
  onClose,
}: HighlightMarkPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const showAbove = anchorRect.top > 80;
  const left = anchorRect.left + anchorRect.width / 2;
  const top = showAbove ? anchorRect.top - 8 : anchorRect.bottom + 8;

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [onClose]);

  return createPortal(
    <div
      className="fixed z-100"
      style={{
        left,
        top,
        transform: showAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      <motion.div
        ref={popoverRef}
        data-highlight-popover
        className={cn(
          "flex items-center gap-1 rounded-lg border bg-popover px-2 py-1.5",
          "shadow-xl ring-1 ring-border/40",
        )}
        style={{
          transformOrigin: showAbove ? "bottom center" : "top center",
        }}
        initial={{ opacity: 0, scale: 0.86, y: showAbove ? 8 : -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.86, y: showAbove ? 8 : -8 }}
        transition={POPOVER_SPRING}
        onMouseDown={(e) => e.preventDefault()}
      >
        {HIGHLIGHT_COLORS.map((color) => (
          <motion.button
            key={color.id}
            type="button"
            className={cn(
              "h-6 w-6 rounded-full border transition-[border-color,box-shadow]",
              currentColor === color.id
                ? "border-foreground/50 ring-2 ring-ring/30 scale-110"
                : "border-border/50",
            )}
            style={{ backgroundColor: color.swatch }}
            title={`Change to ${color.label}`}
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            onClick={() => onRecolor(color.id)}
          />
        ))}
        <div className="mx-1 h-5 w-px bg-border" />
        <motion.button
          type="button"
          className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Remove highlight"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </motion.button>
      </motion.div>
    </div>,
    document.body,
  );
}
