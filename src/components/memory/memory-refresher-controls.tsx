import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ENTER_TO_CHECK_HINT,
  FIRST_LETTERS_HINT_LABEL,
  NEED_A_REFRESHER_LABEL,
} from "@/lib/memory-copy";
import { cn } from "@/lib/utils";
import { maskVerseText, type HintToken } from "@/lib/verse-hint";

export function EnterToCheckHint({ className }: { className?: string }) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {ENTER_TO_CHECK_HINT}
    </span>
  );
}

export function NeedARefresherLink({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center gap-1 text-[12.5px] font-medium text-foreground sm:h-auto"
      onClick={onClick}
      disabled={disabled}
    >
      <Lightbulb className="size-3.5" aria-hidden />
      {NEED_A_REFRESHER_LABEL}
    </button>
  );
}

export function NeedARefresherButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 flex-1 sm:flex-none"
      onClick={onClick}
      disabled={disabled}
    >
      <Lightbulb className="h-4 w-4" aria-hidden />
      {NEED_A_REFRESHER_LABEL}
    </Button>
  );
}

export function FirstLettersPanel({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const tokens = maskVerseText(text, "first-letters");
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/75 px-4 py-3 text-left",
        className,
      )}
    >
      <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Lightbulb className="size-3.5" aria-hidden />
        {FIRST_LETTERS_HINT_LABEL}
      </p>
      <p className="whitespace-pre-wrap">
        {tokens.map((token, index) => (
          <FirstLetterToken key={index} token={token} />
        ))}
      </p>
    </div>
  );
}

function FirstLetterToken({ token }: { token: HintToken }) {
  return (
    <span
      className={cn(
        token.masked && "font-mono tracking-wide text-muted-foreground",
      )}
    >
      {token.text}
    </span>
  );
}
