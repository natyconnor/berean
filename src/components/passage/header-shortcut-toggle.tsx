import { useId, useRef, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { tooltipOpensOnFocus } from "@/components/ui/tooltip-focus";
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
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  return (
    <Tooltip open={open}>
      {/*
        The trigger has to stay off the switch. Radix writes its own
        data-state (closed / instant-open) onto the trigger, which would
        replace the switch's checked / unchecked state and clear the track.
      */}
      <TooltipTrigger asChild>
        <div
          ref={chipRef}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-md border px-2 py-1 transition-[background-color,border-color,box-shadow,color] duration-200",
            className,
          )}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => {
            const active = document.activeElement;
            if (active instanceof Node && chipRef.current?.contains(active)) {
              return;
            }
            setOpen(false);
          }}
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
            aria-describedby={open ? tooltipId : undefined}
            onFocus={() => {
              if (tooltipOpensOnFocus()) setOpen(true);
            }}
            onBlur={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && chipRef.current?.contains(next)) {
                return;
              }
              setOpen(false);
            }}
            onCheckedChange={(nextChecked) => {
              if (nextChecked !== checked) {
                onToggle();
              }
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent id={tooltipId}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
