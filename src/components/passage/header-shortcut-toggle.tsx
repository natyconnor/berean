import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SHORTCUT_KBD_CLASS } from "./header-chrome";

interface HeaderShortcutToggleProps {
  id: string;
  label: string;
  shortcut: string;
  checked: boolean;
  onToggle: () => void;
  tooltip: string;
  /** Container-query class that visually hides `label` in compact chrome. */
  compactLabelClassName: string;
  icon?: ReactNode;
  className?: string;
  labelClassName?: string;
}

export function HeaderShortcutToggle({
  id,
  label,
  shortcut,
  checked,
  onToggle,
  tooltip,
  compactLabelClassName,
  icon,
  className,
  labelClassName,
}: HeaderShortcutToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-md border px-2 py-1 transition-[background-color,border-color,box-shadow,color] duration-200",
            className,
          )}
        >
          <label
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-xs font-medium transition-colors",
              labelClassName,
            )}
          >
            {icon}
            <span className={compactLabelClassName}>{label}</span>
            <kbd className={SHORTCUT_KBD_CLASS}>{shortcut}</kbd>
          </label>
          <Switch
            id={id}
            checked={checked}
            onCheckedChange={(nextChecked) => {
              if (nextChecked !== checked) {
                onToggle();
              }
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
