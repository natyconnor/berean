import { useState } from "react";
import { Check, LayoutTemplate } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useNoteUiVariant } from "@/components/notes/use-note-ui-variant";
import { NOTE_UI_VARIANTS } from "@/lib/note-ui-variant";
import { cn } from "@/lib/utils";

export function NoteUiVariantMenu() {
  const { variant, setVariant } = useNoteUiVariant();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          tooltip="Note appearance"
          aria-label="Note appearance"
        >
          <LayoutTemplate className="h-4 w-4" />
        </TooltipButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-56 p-1.5"
        data-passage-dismiss-exempt
      >
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1.5">
          Note appearance
        </p>
        <div
          className="space-y-0.5"
          role="radiogroup"
          aria-label="Note appearance"
        >
          {NOTE_UI_VARIANTS.map((entry) => {
            const isActive = variant === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                title={entry.description}
                className={cn(
                  "w-full flex flex-col items-stretch gap-0.5 px-2 py-2 rounded-md text-left transition-colors cursor-pointer",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted",
                )}
                onClick={() => {
                  setVariant(entry.id);
                  setOpen(false);
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium leading-none">
                    {entry.label}
                  </span>
                  {isActive ? (
                    <Check className="h-3 w-3 text-primary shrink-0" />
                  ) : null}
                </div>
                {entry.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-snug pr-6">
                    {entry.description}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
