import { useId, useState, type JSX, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { HIDE_PROGRESS_LABEL, SHOW_PROGRESS_LABEL } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";

/** Phone-only disclosure for Progress / Verse panels under a Refresh card. */
export function ShowProgress({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? HIDE_PROGRESS_LABEL : SHOW_PROGRESS_LABEL}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div id={panelId} className={cn("mt-3", !open && "max-md:hidden")}>
        {children}
      </div>
    </div>
  );
}
