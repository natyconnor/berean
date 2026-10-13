import { useId, useMemo, useState, type KeyboardEvent } from "react";

import {
  buildReferenceSuggestions,
  type ReferenceSuggestion,
} from "@/lib/reference-autocomplete";

/**
 * Combobox state for a reference input: suggestions under it while the text
 * is partial, Up/Down to move, Enter or Tab to accept, Esc to close. Spread
 * `inputProps` on the input, call `onKeyDown` first from its key handler, and
 * render the list while `open`.
 */
export function useReferenceAutocomplete({
  query,
  onQueryChange,
  enabled = true,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  /** Off once the text is a complete reference. */
  enabled?: boolean;
}) {
  const listboxId = useId();
  const suggestions = useMemo(
    () => (enabled ? buildReferenceSuggestions(query) : []),
    [enabled, query],
  );
  const [focused, setFocused] = useState(false);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState({ query, index: 0 });

  const open = focused && dismissedQuery !== query && suggestions.length > 0;
  const activeIndex =
    highlight.query === query
      ? Math.max(0, Math.min(highlight.index, suggestions.length - 1))
      : 0;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const highlightIndex = (index: number) => setHighlight({ query, index });
  const accept = (suggestion: ReferenceSuggestion) =>
    onQueryChange(suggestion.text);

  /** Handles keys the list owns; `true` when it did. */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): boolean => {
    if (suggestions.length === 0 || event.nativeEvent.isComposing) {
      return false;
    }
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = open
          ? (activeIndex + step + suggestions.length) % suggestions.length
          : step === 1
            ? 0
            : suggestions.length - 1;
        setDismissedQuery(null);
        highlightIndex(next);
        return true;
      }
      case "Enter":
      case "Tab": {
        if (!open || event.shiftKey) return false;
        event.preventDefault();
        accept(suggestions[activeIndex]);
        return true;
      }
      case "Escape": {
        if (!open) return false;
        event.preventDefault();
        event.stopPropagation();
        setDismissedQuery(query);
        return true;
      }
      default:
        return false;
    }
  };

  return {
    open,
    suggestions,
    activeIndex,
    listboxId,
    optionId,
    highlightIndex,
    accept,
    onKeyDown,
    inputProps: {
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open,
      "aria-controls": listboxId,
      "aria-activedescendant": open ? optionId(activeIndex) : undefined,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
