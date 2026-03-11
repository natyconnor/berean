import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { VerseRefHoverPreview } from "@/components/verse-ref/verse-ref-hover-preview"
import type { VerseRef } from "@/lib/verse-ref-utils"

interface VerseLinkPillProps {
  refValue: VerseRef
  label: string
  editable?: boolean
  onRemove?: () => void
  className?: string
}

export function VerseLinkPill({
  refValue,
  label,
  editable = false,
  onRemove,
  className,
}: VerseLinkPillProps) {
  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100/80 px-2 py-0.5 align-baseline text-xs font-medium text-sky-900 dark:border-sky-700/60 dark:bg-sky-900/35 dark:text-sky-100",
        editable && "pr-1",
        className
      )}
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
  )

  if (editable) {
    return pill
  }

  return (
    <VerseRefHoverPreview refValue={refValue}>
      <span className="inline-block cursor-help">{pill}</span>
    </VerseRefHoverPreview>
  )
}
