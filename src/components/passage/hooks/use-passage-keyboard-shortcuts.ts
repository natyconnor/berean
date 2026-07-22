import { useEffect, useRef } from "react";

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest(EDITABLE_SELECTOR) !== null;
}

/** Prefer `code` (physical key) so layout / webview quirks don't break shortcuts. */
function shortcutLetter(event: KeyboardEvent): string | null {
  if (event.code.startsWith("Key") && event.code.length === 4) {
    return event.code.slice(3).toLowerCase();
  }
  if (event.key.length === 1) {
    return event.key.toLowerCase();
  }
  return null;
}

interface ChapterDestination {
  passageId: string;
  label: string;
}

interface UsePassageKeyboardShortcutsOptions {
  previous: ChapterDestination | null;
  next: ChapterDestination | null;
  navigateActiveTab: (passageId: string, label: string) => void;
  setViewMode: (mode: "compose" | "read") => void;
  onToggleFocusMode?: () => void;
  onToggleSectionHeaders?: () => void;
}

export function usePassageKeyboardShortcuts({
  previous,
  next,
  navigateActiveTab,
  setViewMode,
  onToggleFocusMode,
  onToggleSectionHeaders,
}: UsePassageKeyboardShortcutsOptions) {
  const previousRef = useRef(previous);
  const nextRef = useRef(next);
  const navigateActiveTabRef = useRef(navigateActiveTab);
  const setViewModeRef = useRef(setViewMode);
  const onToggleFocusModeRef = useRef(onToggleFocusMode);
  const onToggleSectionHeadersRef = useRef(onToggleSectionHeaders);

  useEffect(() => {
    previousRef.current = previous;
    nextRef.current = next;
    navigateActiveTabRef.current = navigateActiveTab;
    setViewModeRef.current = setViewMode;
    onToggleFocusModeRef.current = onToggleFocusMode;
    onToggleSectionHeadersRef.current = onToggleSectionHeaders;
  }, [
    previous,
    next,
    navigateActiveTab,
    setViewMode,
    onToggleFocusMode,
    onToggleSectionHeaders,
  ]);

  useEffect(() => {
    function handleNavigationKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      if (event.key === "ArrowLeft" && previousRef.current) {
        navigateActiveTabRef.current(
          previousRef.current.passageId,
          previousRef.current.label,
        );
      } else if (event.key === "ArrowRight" && nextRef.current) {
        navigateActiveTabRef.current(
          nextRef.current.passageId,
          nextRef.current.label,
        );
      }
    }

    document.addEventListener("keydown", handleNavigationKeyDown);
    return () =>
      document.removeEventListener("keydown", handleNavigationKeyDown);
  }, []);

  useEffect(() => {
    function handleModeShortcuts(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const key = shortcutLetter(event);
      if (key === "r") {
        event.preventDefault();
        setViewModeRef.current("read");
      } else if (key === "c") {
        event.preventDefault();
        setViewModeRef.current("compose");
      } else if (key === "f" && onToggleFocusModeRef.current) {
        event.preventDefault();
        onToggleFocusModeRef.current();
      } else if (key === "h" && onToggleSectionHeadersRef.current) {
        event.preventDefault();
        onToggleSectionHeadersRef.current();
      }
    }

    // Capture so we still see the event if a focused control stops bubbling.
    document.addEventListener("keydown", handleModeShortcuts, true);
    return () =>
      document.removeEventListener("keydown", handleModeShortcuts, true);
  }, []);
}
