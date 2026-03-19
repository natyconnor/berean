import { useCallback, useState } from "react";
import type { HighlightRange } from "@/lib/highlight-utils";

export interface HighlightPopoverState {
  highlightId: string;
  rect: DOMRect;
  currentColor: string;
}

interface UseHighlightPopoverOptions {
  highlights: HighlightRange[] | undefined;
  onDeleteHighlight: ((highlightId: string) => void) | undefined;
  onRecolorHighlight:
    | ((highlightId: string, color: string) => void)
    | undefined;
}

export interface UseHighlightPopoverReturn {
  markPopover: HighlightPopoverState | null;
  activeHighlightId: string | null;
  handleMarkClick: (highlightId: string, rect: DOMRect) => void;
  handlePopoverClose: () => void;
  handlePopoverDelete: () => void;
  handlePopoverRecolor: (color: string) => void;
}

export function useHighlightPopover({
  highlights,
  onDeleteHighlight,
  onRecolorHighlight,
}: UseHighlightPopoverOptions): UseHighlightPopoverReturn {
  const [markPopover, setMarkPopover] =
    useState<HighlightPopoverState | null>(null);

  const handleMarkClick = useCallback(
    (highlightId: string, rect: DOMRect) => {
      const color =
        highlights?.find((h) => h.highlightId === highlightId)?.color ?? "";
      setMarkPopover({ highlightId, rect, currentColor: color });
    },
    [highlights],
  );

  const handlePopoverClose = useCallback(() => {
    setMarkPopover(null);
  }, []);

  const handlePopoverDelete = useCallback(() => {
    if (!markPopover) return;
    onDeleteHighlight?.(markPopover.highlightId);
    setMarkPopover(null);
  }, [markPopover, onDeleteHighlight]);

  const handlePopoverRecolor = useCallback(
    (color: string) => {
      if (!markPopover) return;
      onRecolorHighlight?.(markPopover.highlightId, color);
      setMarkPopover(null);
    },
    [markPopover, onRecolorHighlight],
  );

  return {
    markPopover,
    activeHighlightId: markPopover?.highlightId ?? null,
    handleMarkClick,
    handlePopoverClose,
    handlePopoverDelete,
    handlePopoverRecolor,
  };
}
