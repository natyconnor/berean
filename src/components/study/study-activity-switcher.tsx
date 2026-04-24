import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ActivityOption, SessionView } from "./study-activity-options";

interface StudyActivitySwitcherProps {
  active: SessionView;
  options: ActivityOption[];
  onChange: (view: SessionView) => void;
}

export function StudyActivitySwitcher({
  active,
  options,
  onChange,
}: StudyActivitySwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Study activity"
      className="flex flex-wrap gap-1.5"
    >
      {options.map((opt) => {
        const isActive = opt.view === active;
        const button = (
          <button
            key={opt.view}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={!opt.available}
            onClick={() => opt.available && onChange(opt.view)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : opt.available
                  ? "bg-background text-foreground border-border hover:bg-muted cursor-pointer"
                  : "bg-muted/40 text-muted-foreground border-border cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );

        const tooltipText =
          !opt.available && opt.disabledReason
            ? opt.disabledReason
            : opt.description;

        return (
          <Tooltip key={opt.view}>
            <TooltipTrigger asChild>
              <span>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{tooltipText}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
