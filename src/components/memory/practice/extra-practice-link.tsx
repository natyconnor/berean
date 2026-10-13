import type { JSX } from "react";
import { Dumbbell } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EXTRA_PRACTICE_LABEL,
  EXTRA_PRACTICE_TOOLTIP,
} from "@/lib/memory-copy";

/** The quiet "Extra practice" beside a session summary's Done. */
export function ExtraPracticeLink({ href }: { href: string }): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          className="text-muted-foreground max-sm:h-11"
        >
          <InternalLink href={href}>
            <Dumbbell aria-hidden />
            {EXTRA_PRACTICE_LABEL}
          </InternalLink>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {EXTRA_PRACTICE_TOOLTIP}
      </TooltipContent>
    </Tooltip>
  );
}
