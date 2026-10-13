import { createContext, useContext, type MouseEvent } from "react";

import type { MemoryPanel, MemoryPanelFrom } from "@/lib/memory-panel";

export type MemoryPanelSurface = "drawer" | "page";

export interface MemoryPanelBackLink {
  label: string;
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * What a panel body needs to know about where it is shown. The drawer host
 * on `/memory` and the full pages provide it; bodies and
 * {@link MemoryPanelFrame} read it, so one body works in both.
 */
export interface MemoryPanelFrameValue {
  surface: MemoryPanelSurface;
  panel: MemoryPanel;
  from: MemoryPanelFrom | undefined;
  /** Where session links return: plain Today from a drawer, else this page. */
  returnTo: string;
  /** Shows another panel on this surface: a drawer swap, or its full page. */
  hrefFor: (panel: MemoryPanel, opts?: { from?: MemoryPanelFrom }) => string;
  /** "‹ Your verses" in a drawer; "‹ Today" or "‹ Your verses" on a page. */
  back: MemoryPanelBackLink | undefined;
  /** Drawer only: the matching full page. */
  fullPageHref: string | undefined;
  /** Drawer only: close the drawer. */
  close: (() => void) | undefined;
  /** Leave once the item is gone: back to Your verses if opened there, else Today. */
  exit: () => void;
}

export const MemoryPanelFrameContext =
  createContext<MemoryPanelFrameValue | null>(null);

export function useMemoryPanelFrame(): MemoryPanelFrameValue {
  const value = useContext(MemoryPanelFrameContext);
  if (!value) {
    throw new Error(
      "useMemoryPanelFrame must be used inside MemoryPanelHost or MemoryPanelPage",
    );
  }
  return value;
}
