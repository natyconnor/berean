import { ArrowLeft, House } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isMemoryHomeHref,
  MEMORY_HOME,
  memoryExitName,
} from "@/lib/memory-exit";

const HOME_LABEL = "Go to Memory";

/** Session header Back, plus Home when Back does not already go to Memory. */
export function SessionBackButton({
  onExit,
  onHome,
  label,
  exitHref = MEMORY_HOME,
}: {
  onExit: () => void;
  onHome?: () => void;
  label: string;
  exitHref?: string;
}) {
  const name = memoryExitName(label);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExit}
            aria-label={label}
            className="-ml-2 h-11 min-w-11 shrink-0 gap-1.5 px-2 sm:h-8"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="max-w-[14ch] truncate sm:hidden">{name}</span>
            <span className="hidden max-w-[24ch] truncate sm:inline">
              {label}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      {isMemoryHomeHref(exitHref) ? null : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="size-11 shrink-0 text-muted-foreground hover:text-foreground sm:size-8"
            >
              <InternalLink
                href={MEMORY_HOME}
                aria-label={HOME_LABEL}
                onClick={onHome}
              >
                <House className="size-4" aria-hidden />
              </InternalLink>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{HOME_LABEL}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
