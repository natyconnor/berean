import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import type { MemorizeTarget } from "@/lib/memorize-target";

import {
  MemorizeSheetContext,
  type MemorizeSheetApi,
  type MemorizeSheetOpenOptions,
} from "./memorize-context";
import { MemorizeSheet } from "./memorize-sheet";

/**
 * Owns the single Memorize sheet. Every entry point calls
 * `useMemorizeSheet().open(target)` (from `./memorize-context`); the last
 * target stays rendered while the sheet animates closed.
 */
export function MemorizeProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{
    target: MemorizeTarget;
    id: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openSheet = useCallback(
    (target: MemorizeTarget, options?: MemorizeSheetOpenOptions) => {
      const active = document.activeElement;
      returnFocusRef.current =
        options?.returnFocusTo ??
        (active instanceof HTMLElement && active !== document.body
          ? active
          : null);
      setSession((current) => ({ target, id: (current?.id ?? 0) + 1 }));
      setOpen(true);
    },
    [],
  );

  const restoreFocus = useCallback((event: Event) => {
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    if (!opener?.isConnected) return;
    event.preventDefault();
    opener.focus();
  }, []);

  const value = useMemo<MemorizeSheetApi>(
    () => ({ open: openSheet }),
    [openSheet],
  );

  return (
    <MemorizeSheetContext.Provider value={value}>
      {children}
      <MemorizeSheet
        key={session?.id}
        target={session?.target ?? null}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={restoreFocus}
      />
    </MemorizeSheetContext.Provider>
  );
}
