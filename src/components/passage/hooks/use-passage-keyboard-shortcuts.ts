import { useEffect } from "react";

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest(EDITABLE_SELECTOR) !== null;
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
}

export function usePassageKeyboardShortcuts({
  previous,
  next,
  navigateActiveTab,
  setViewMode,
}: UsePassageKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleNavigationKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      if (event.key === "ArrowLeft" && previous) {
        navigateActiveTab(previous.passageId, previous.label);
      } else if (event.key === "ArrowRight" && next) {
        navigateActiveTab(next.passageId, next.label);
      }
    }

    document.addEventListener("keydown", handleNavigationKeyDown);
    return () =>
      document.removeEventListener("keydown", handleNavigationKeyDown);
  }, [navigateActiveTab, next, previous]);

  useEffect(() => {
    function handleModeShortcuts(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        setViewMode("read");
      } else if (key === "c") {
        event.preventDefault();
        setViewMode("compose");
      }
    }

    document.addEventListener("keydown", handleModeShortcuts);
    return () => document.removeEventListener("keydown", handleModeShortcuts);
  }, [setViewMode]);
}
