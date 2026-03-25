import { useCallback, useState } from "react";

const FOCUS_MODE_STORAGE_KEY = "bible-notes-focus-mode";

function resolveInitialFocusMode(): boolean {
  try {
    const saved = localStorage.getItem(FOCUS_MODE_STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // localStorage unavailable
  }
  return false;
}

interface UseFocusModeResult {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
}

export function useFocusMode(): UseFocusModeResult {
  const [isFocusMode, setIsFocusMode] = useState(resolveInitialFocusMode);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return { isFocusMode, toggleFocusMode };
}
