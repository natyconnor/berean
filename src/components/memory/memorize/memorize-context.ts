import { createContext, useContext } from "react";

import type { MemorizeTarget } from "@/lib/memorize-target";

export interface MemorizeSheetOpenOptions {
  /**
   * Where focus goes when the sheet closes. Defaults to whatever had focus
   * when `open` was called; pass this when that element is about to unmount
   * (for example a picker that closes as the sheet opens).
   */
  returnFocusTo?: HTMLElement | null;
}

export interface MemorizeSheetApi {
  open: (target: MemorizeTarget, options?: MemorizeSheetOpenOptions) => void;
}

export const MemorizeSheetContext = createContext<MemorizeSheetApi | null>(
  null,
);

/** Opens the one Memorize sheet mounted by `MemorizeProvider`. */
export function useMemorizeSheet(): MemorizeSheetApi {
  const ctx = useContext(MemorizeSheetContext);
  if (!ctx) {
    throw new Error("useMemorizeSheet must be used inside MemorizeProvider");
  }
  return ctx;
}
