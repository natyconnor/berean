import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { memoryExitName } from "@/lib/memory-exit";

/** Session header Back: full phrase on desktop, destination name on mobile. */
export function SessionBackButton({
  onExit,
  label,
}: {
  onExit: () => void;
  label: string;
}) {
  const name = memoryExitName(label);
  return (
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
  );
}
