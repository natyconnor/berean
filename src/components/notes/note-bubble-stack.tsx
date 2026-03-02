import { Badge } from "@/components/ui/badge"
import { StackedCardBackground } from "./view/note-card-primitives"

interface NoteBubbleStackProps {
  count: number
  firstNotePreview: string
  verseLabel: string
  onClick: () => void
}

export function NoteBubbleStack({
  count,
  firstNotePreview,
  verseLabel,
  onClick,
}: NoteBubbleStackProps) {
  return (
    <div className="relative cursor-pointer" onClick={onClick}>
      <StackedCardBackground count={count} />
      <div className="relative border rounded-lg p-3 bg-card transition-all hover:shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <Badge variant="secondary" className="text-xs font-normal">
            {verseLabel}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {count} notes
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {firstNotePreview}
        </p>
      </div>
    </div>
  )
}
