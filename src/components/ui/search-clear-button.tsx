import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Clears a search field, in place of the browser's own cancel button (hidden
 * in `index.css`). Sits at the right edge of a `relative` wrapper around the
 * input; give the input right padding (`pr-10`) so text runs under neither.
 * Refocuses the input so typing can continue.
 */
export function SearchClearButton({
  onClear,
  label = "Clear search",
  className,
}: {
  onClear: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        onClear();
        event.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      className={cn(
        "absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors outline-none after:absolute after:-inset-2 hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
