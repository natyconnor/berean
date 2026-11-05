import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

interface TooltipButtonProps extends ComponentProps<typeof Button> {
  tooltip: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function TooltipButton({ tooltip, side, ...props }: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props} />
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
