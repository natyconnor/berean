import { Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface NoteCardActionsProps {
  onEdit: () => void
  onDelete: () => void
  variant?: "default" | "passage"
}

export function NoteCardActions({ onEdit, onDelete, variant = "default" }: NoteCardActionsProps) {
  const hoverBg = variant === "passage" 
    ? "hover:bg-amber-100 dark:hover:bg-amber-800/30" 
    : "hover:bg-muted"

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn("p-1 rounded transition-colors", hoverBg)}
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Edit note</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="p-1 rounded hover:bg-destructive/10 transition-colors"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete note</TooltipContent>
      </Tooltip>
    </div>
  )
}

export interface NoteTagListProps {
  tags: string[]
  variant?: "default" | "passage"
  size?: "sm" | "xs"
  className?: string
}

export function NoteTagList({ tags, variant = "default", size = "xs", className }: NoteTagListProps) {
  if (tags.length === 0) return null

  const borderClass = variant === "passage" 
    ? "border-amber-300 dark:border-amber-600/45" 
    : ""
  const sizeClass = size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs"

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(sizeClass, borderClass)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  )
}

export interface NoteContentProps {
  content: string
  truncateAt?: number
  className?: string
}

export function NoteContent({ content, truncateAt, className }: NoteContentProps) {
  const displayContent = truncateAt && content.length > truncateAt
    ? content.slice(0, truncateAt) + "..."
    : content

  return (
    <p className={cn("leading-relaxed whitespace-pre-wrap", className)}>
      {displayContent}
    </p>
  )
}

export interface StackedCardBackgroundProps {
  count: number
  variant?: "default" | "muted"
}

export function StackedCardBackground({ count, variant = "default" }: StackedCardBackgroundProps) {
  const bgClass = variant === "muted" ? "bg-muted/40" : "bg-muted/50"
  const bgClass2 = variant === "muted" ? "bg-muted/60" : "bg-muted/70"

  return (
    <>
      {count > 2 && (
        <div className={cn("absolute inset-0 translate-x-1 translate-y-1 rounded-lg border", bgClass)} />
      )}
      {count > 1 && (
        <div className={cn("absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-lg border", bgClass2)} />
      )}
    </>
  )
}

export interface HoverEditButtonProps {
  onEdit: () => void
  variant?: "default" | "passage"
}

export function HoverEditButton({ onEdit, variant = "default" }: HoverEditButtonProps) {
  const hoverBg = variant === "passage" 
    ? "hover:bg-amber-100 dark:hover:bg-amber-800/30" 
    : "hover:bg-muted"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded transition-all",
            hoverBg
          )}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Edit note</TooltipContent>
    </Tooltip>
  )
}
