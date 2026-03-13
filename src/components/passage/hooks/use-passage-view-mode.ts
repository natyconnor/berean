import { useCallback, useState } from "react";

type PassageViewMode = "compose" | "read";

const READING_MODE_STORAGE_KEY = "bible-notes-passage-view-mode";

function resolveInitialViewMode(): PassageViewMode {
  try {
    const saved = localStorage.getItem(READING_MODE_STORAGE_KEY);
    if (saved === "compose" || saved === "read") {
      return saved;
    }
  } catch {
    // localStorage unavailable
  }
  return "compose";
}

interface UsePassageViewModeOptions {
  focusRange: { startVerse: number; endVerse: number } | null;
  forcedViewMode?: PassageViewMode;
  focusSource?: "search";
}

interface UsePassageViewModeResult {
  effectiveViewMode: PassageViewMode;
  isReadMode: boolean;
  editorMode: "dialog" | "inline";
  setViewMode: (next: PassageViewMode) => void;
}

export function usePassageViewMode({
  focusRange,
  forcedViewMode,
  focusSource,
}: UsePassageViewModeOptions): UsePassageViewModeResult {
  const [searchModeLock, setSearchModeLock] = useState(
    () => focusSource === "search" && forcedViewMode === "read" && !!focusRange,
  );
  const [viewMode, setViewModeState] = useState<PassageViewMode>(() =>
    focusSource === "search" && forcedViewMode === "read"
      ? "read"
      : resolveInitialViewMode(),
  );

  const setViewMode = useCallback((next: PassageViewMode) => {
    setSearchModeLock(false);
    setViewModeState(next);
    try {
      localStorage.setItem(READING_MODE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const hasFocusRange =
    typeof focusRange?.startVerse === "number" &&
    typeof focusRange?.endVerse === "number";
  const isFocusNavigation =
    searchModeLock &&
    focusSource === "search" &&
    forcedViewMode === "read" &&
    hasFocusRange;
  const effectiveViewMode: PassageViewMode = isFocusNavigation
    ? "read"
    : viewMode;

  return {
    effectiveViewMode,
    isReadMode: effectiveViewMode === "read",
    editorMode: effectiveViewMode === "read" ? "dialog" : "inline",
    setViewMode,
  };
}
