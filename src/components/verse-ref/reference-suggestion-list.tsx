import { BookOpen } from "lucide-react";

import type { ReferenceSuggestion } from "@/lib/reference-autocomplete";
import { cn } from "@/lib/utils";

/**
 * The listbox under a reference combobox (`useReferenceAutocomplete`).
 * Options never take focus: the input keeps it and points at the active one.
 */
export function ReferenceSuggestionList({
  id,
  label,
  suggestions,
  activeIndex,
  optionId,
  onHighlight,
  onAccept,
  className,
}: {
  id: string;
  label: string;
  suggestions: readonly ReferenceSuggestion[];
  activeIndex: number;
  optionId: (index: number) => string;
  onHighlight: (index: number) => void;
  onAccept: (suggestion: ReferenceSuggestion) => void;
  className?: string;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      className={cn(
        "rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
        className,
      )}
    >
      {suggestions.map((suggestion, index) => {
        const active = index === activeIndex;
        return (
          <li
            key={suggestion.key}
            id={optionId(index)}
            role="option"
            aria-selected={active}
            className={cn(
              "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm max-sm:min-h-11",
              active && "bg-accent text-accent-foreground",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => {
              if (!active) onHighlight(index);
            }}
            onClick={() => onAccept(suggestion)}
          >
            <BookOpen
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {suggestion.label}
            </span>
            {suggestion.description ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                <span className="sr-only">,</span> {suggestion.description}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
