import { useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { useEsvReference } from "@/hooks/use-esv-reference"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatVerseRef, type VerseRef } from "@/lib/verse-ref-utils"

interface VerseRefHoverPreviewProps {
  refValue: VerseRef
  children: ReactNode
}

interface VerseRefPreviewContentProps {
  refValue: VerseRef
  loading: boolean
  error: string | null
  verses: Array<{ number: number; text: string }>
}

export function VerseRefPreviewContent({
  refValue,
  loading,
  error,
  verses,
}: VerseRefPreviewContentProps) {
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {formatVerseRef(refValue)}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs opacity-80">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading verse...
        </div>
      ) : error ? (
        <p className="max-w-sm text-xs leading-relaxed">{error}</p>
      ) : verses.length === 0 ? (
        <p className="max-w-sm text-xs leading-relaxed">No verse preview available.</p>
      ) : (
        <div className="space-y-1">
          {verses.map((verse) => (
            <p key={verse.number} className="max-w-sm text-xs leading-relaxed">
              <span className="mr-1 font-semibold opacity-80">{verse.number}</span>
              {verse.text}
            </p>
          ))}
        </div>
      )}
    </>
  )
}

export function VerseRefPreviewCard({ refValue }: { refValue: VerseRef }) {
  const { data, loading, error } = useEsvReference(refValue)
  return (
    <VerseRefPreviewContent
      refValue={refValue}
      loading={loading}
      error={error}
      verses={data?.verses ?? []}
    />
  )
}

export function VerseRefHoverPreview({ refValue, children }: VerseRefHoverPreviewProps) {
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-sm space-y-2 px-3 py-2 text-left">
        {open ? <VerseRefPreviewCard refValue={refValue} /> : null}
      </TooltipContent>
    </Tooltip>
  )
}
