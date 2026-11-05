import { Lightbulb } from "lucide-react";

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
}: {
  passage?: boolean;
  onRefresher?: () => void;
  disabled?: boolean;
  message?: string;
}) {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 text-center font-sans">
      <p className="max-w-sm text-sm text-muted-foreground">
        {message ??
          (passage ? FROM_MEMORY_EMPTY_HINT_PASSAGE : FROM_MEMORY_EMPTY_HINT)}
      </p>
      {onRefresher ? (
        <NeedARefresherLink onClick={onRefresher} disabled={disabled} />
      ) : null}
    </div>
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
