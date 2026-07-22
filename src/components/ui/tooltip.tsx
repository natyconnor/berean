"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

let shouldOpenTooltipOnFocus = false;

function TooltipProvider({
  delayDuration = 150,
  // Radix keeps an open tooltip on pointer-leave when hoverable content is
  // enabled, so the user can move onto the content. Our TooltipContent uses
  // `pointer-events-none`, so that path never works and tooltips often stay
  // open until the next click. Closing on trigger leave matches non-interactive
  // bubbles and fixes "stuck" tooltips after hover/click.
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  React.useEffect(() => {
    const disableFocusOpen = () => {
      shouldOpenTooltipOnFocus = false;
    };
    const updateFocusIntent = (event: KeyboardEvent) => {
      // Radix opens tooltips on focus. In this app many buttons open dialogs or
      // navigate, and focus is then restored programmatically to the trigger
      // after pointer clicks or Escape closes. Only Tab should make a focus
      // event announce the tooltip; pointer hover still opens normally.
      shouldOpenTooltipOnFocus = event.key === "Tab";
    };

    document.addEventListener("keydown", updateFocusIntent, { capture: true });
    document.addEventListener("pointerdown", disableFocusOpen, {
      capture: true,
    });
    return () => {
      document.removeEventListener("keydown", updateFocusIntent, {
        capture: true,
      });
      document.removeEventListener("pointerdown", disableFocusOpen, {
        capture: true,
      });
    };
  }, []);

  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  onFocus,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onFocus={(event) => {
        onFocus?.(event);

        if (!shouldOpenTooltipOnFocus) {
          event.preventDefault();
        }
      }}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 4,
  showArrow = true,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  showArrow?: boolean;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-none bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className,
        )}
        {...props}
      >
        {children}
        {showArrow ? (
          <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
        ) : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
