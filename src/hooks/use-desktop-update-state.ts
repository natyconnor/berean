import { useEffect, useState } from "react";
import type { DesktopUpdateState } from "@/lib/desktop-platform";

/**
 * The desktop shell's self-update state, or null on the website, on a shell
 * too old to report it, and until the shell first answers.
 */
export function useDesktopUpdateState(): DesktopUpdateState | null {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  useEffect(() => window.bereanDesktop?.subscribeToUpdates?.(setState), []);
  return state;
}
