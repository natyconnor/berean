import { type Ref, useId } from "react";
import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { NEED_A_REFRESHER_LABEL } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";

const FROM_MEMORY_EMPTY_HINT =
  "No hint text. Type the verse from memory, then check your answer.";
const FROM_MEMORY_EMPTY_HINT_PASSAGE =
  "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.";

export function EmptyHintPrompt({
  passage = false,
  onRefresher,
  disabled,
  message,
  messageId,
}: {
  passage?: boolean;
  onRefresher?: () => void;
  disabled?: boolean;
  message?: string;
  messageId?: string;
}) {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 text-center font-sans">
      <p id={messageId} className="max-w-sm text-sm text-muted-foreground">
        {message ??
          (passage ? FROM_MEMORY_EMPTY_HINT_PASSAGE : FROM_MEMORY_EMPTY_HINT)}
      </p>
      {onRefresher ? (
        <NeedARefresherLink onClick={onRefresher} disabled={disabled} />
      ) : null}
    </div>
  );
}

export function RefresherOfferButton({
  label,
  onClick,
  disabled,
  buttonRef,
  describedBy,
  tooltip,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  describedBy?: string;
  tooltip?: string;
}) {
  const tooltipId = useId();
  const described = [describedBy, tooltip ? tooltipId : undefined]
    .filter(Boolean)
    .join(" ");
  const body = (
    <>
      <Lightbulb className="h-4 w-4" aria-hidden />
      {label}
    </>
  );
  const shared = {
    ref: buttonRef,
    type: "button" as const,
    variant: "outline" as const,
    className: "flex-1 sm:flex-none",
    onClick,
    disabled,
    "aria-describedby": described || undefined,
  };
  if (!tooltip) {
    return <Button {...shared}>{body}</Button>;
  }
  return (
    <>
      <TooltipButton tooltip={tooltip} side="top" {...shared}>
        {body}
      </TooltipButton>
      <span id={tooltipId} className="sr-only">
        {tooltip}
      </span>
    </>
  );
}

export function NeedARefresherLink({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-[12.5px] font-medium text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Lightbulb className="size-3.5" aria-hidden />
      {NEED_A_REFRESHER_LABEL}
    </button>
  );
}
