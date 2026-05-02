import { useEffect, type ReactNode } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeatureHintState } from "./use-feature-hint";

interface FeatureCalloutProps {
  state: FeatureHintState;
  title: ReactNode;
  description: ReactNode;
  /**
   * Element the callout anchors to. The callout opens whenever
   * `state.pending` is true. Use a wrapping element (e.g. the toolbar button
   * the callout points at) so the popover can position correctly.
   */
  children: ReactNode;
  /**
   * Optional primary action label. When set, clicking the button calls
   * `state.complete()` and `onAction()` if provided. Useful for "Take me there"
   * actions that also navigate the user.
   */
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  /** Override the dismiss button label (defaults to "Got it"). */
  dismissLabel?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  /**
   * When true the anchor element receives a subtle ring while the callout is
   * open, making it easier for the user to associate the message with the
   * highlighted UI.
   */
  highlightAnchor?: boolean;
}

export function FeatureCallout({
  state,
  title,
  description,
  children,
  primaryActionLabel,
  onPrimaryAction,
  dismissLabel = "Got it",
  side = "bottom",
  align = "center",
  className,
  highlightAnchor = true,
}: FeatureCalloutProps) {
  const open = state.pending;

  useEffect(() => {
    if (!open) return;
    if (state.shown) return;
    state.markShown();
  }, [open, state]);

  const handlePrimary = () => {
    onPrimaryAction?.();
    state.complete();
  };

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <span
          className={cn(
            "relative inline-flex",
            open && highlightAnchor && "rounded-md ring-2 ring-primary/60",
          )}
        >
          {children}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={10}
        className={cn(
          "w-72 space-y-3 border-primary/30 bg-popover/95 backdrop-blur",
          className,
        )}
      >
        <PopoverHeader>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            New
          </span>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => state.dismiss()}>
            {dismissLabel}
          </Button>
          {primaryActionLabel ? (
            <Button size="sm" onClick={handlePrimary}>
              {primaryActionLabel}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
