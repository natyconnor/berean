import { type RefObject, useEffect } from "react";

/**
 * Activate `target` on unmodified Enter when the user isn't typing in an
 * editable field and isn't focused on a different interactive control.
 *
 * Used by learning / practice cards so Read Continue and the result-view
 * Continue / Try again share the same keyboard path as the typed-answer
 * Enter shortcut.
 */
export function useEnterToClick(
  target: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    function handleEnter(event: KeyboardEvent) {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toUpperCase();
        // Let editable fields handle their own Enter.
        if (
          tag === "TEXTAREA" ||
          tag === "INPUT" ||
          (active as HTMLElement).isContentEditable
        )
          return;
        // Let other interactive controls (buttons, links, role=button/link)
        // activate naturally — only intercept when focus is on `target`
        // itself (or nowhere interactive).
        const role = active.getAttribute("role") ?? "";
        const isInteractive =
          tag === "BUTTON" ||
          tag === "A" ||
          role === "button" ||
          role === "link";
        if (isInteractive && active !== target.current) return;
      }
      event.preventDefault();
      target.current?.click();
    }
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [enabled, target]);
}
