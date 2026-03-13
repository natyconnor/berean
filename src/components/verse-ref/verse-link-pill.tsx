import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerseRefHoverPreview } from "@/components/verse-ref/verse-ref-hover-preview";
import type { VerseRef } from "@/lib/verse-ref-utils";
import { useVerseLinkNavigation } from "@/hooks/use-verse-link-navigation";
import type { CurrentChapter } from "@/hooks/use-verse-link-navigation";

interface VerseLinkPillProps {
  refValue: VerseRef;
  label: string;
  editable?: boolean;
  onRemove?: () => void;
  currentChapter?: CurrentChapter;
  className?: string;
}

export function VerseLinkPill({
  refValue,
  label,
  editable = false,
  onRemove,
  currentChapter,
  className,
}: VerseLinkPillProps) {
  const navigateToVerse = useVerseLinkNavigation(currentChapter);

  const handleClick = (e: React.MouseEvent) => {
    if (!editable && currentChapter) {
      e.preventDefault();
      e.stopPropagation();
      navigateToVerse(refValue);
    }
  };

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100/80 px-2 py-0.5 align-baseline text-xs font-medium text-sky-900 dark:border-sky-700/60 dark:bg-sky-900/35 dark:text-sky-100",
        editable && "pr-1",
        !editable && currentChapter && "cursor-pointer",
        className,
      )}
      onClick={handleClick}
      role={!editable && currentChapter ? "link" : undefined}
      tabIndex={!editable && currentChapter ? 0 : undefined}
      onKeyDown={
        !editable && currentChapter
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigateToVerse(refValue);
              }
            }
          : undefined
      }
    >
      <span>{label}</span>
      {editable && onRemove ? (
        <button
          type="button"
          className="rounded-full p-0.5 transition-colors hover:bg-sky-200/80 dark:hover:bg-sky-800/60"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );

  if (editable) {
    return pill;
  }

  return (
    <VerseRefHoverPreview refValue={refValue} showClickHint={!!currentChapter}>
      <span
        className={cn(
          "inline-block",
          currentChapter ? "cursor-pointer" : "cursor-help",
        )}
      >
        {pill}
      </span>
    </VerseRefHoverPreview>
  );
}
