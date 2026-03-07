import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { X, BookOpen } from "lucide-react"
import { TagPicker } from "@/components/tags/tag-picker"
import { cn } from "@/lib/utils"
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles"
import { normalizeTags } from "@/lib/tag-utils"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { formatVerseRef } from "@/lib/verse-ref-utils"
import { api } from "../../../convex/_generated/api"

interface NoteEditorProps {
  verseRef: VerseRef
  initialContent?: string
  initialTags?: string[]
  variant?: "default" | "passage"
  presentation?: "card" | "dialog"
  onSave: (content: string, tags: string[]) => void
  onCancel: () => void
}

export function NoteEditor({
  verseRef,
  initialContent = "",
  initialTags = [],
  variant = "default",
  presentation = "card",
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(() => normalizeTags(initialTags))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const catalog = useQuery(api.tags.listCatalog)
  const resolveTagStyle = useStarterTagBadgeStyle()

  const availableTags = useMemo(() => (catalog ?? []).map((entry) => entry.tag), [catalog])

  const addTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }, [])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (content.trim()) {
          onSave(content.trim(), tags)
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    },
    [content, tags, onSave, onCancel]
  )

  const isPassage = variant === "passage"
  const isDialogPresentation = presentation === "dialog"

  return (
    <div
      className={cn(
        "space-y-3",
        isDialogPresentation
          ? "px-1 pb-1"
          : cn(
              "rounded-lg p-2.5 shadow-sm",
              isPassage
                ? "border-l-2 border border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/50 border-l-amber-400 dark:border-l-amber-600/70"
                : "border bg-card"
            )
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between">
        {isPassage ? (
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400/70 shrink-0" />
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400/70 uppercase tracking-wide">
              {formatVerseRef(verseRef)}
            </span>
          </div>
        ) : (
          <Badge variant="secondary" className="text-xs">
            {formatVerseRef(verseRef)}
          </Badge>
        )}
        {!isDialogPresentation && (
          <TooltipButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancel}
            tooltip="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </TooltipButton>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        placeholder="Write your note..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={cn("resize-y text-sm", isDialogPresentation ? "min-h-[180px]" : "min-h-[96px]")}
      />

      <div className="space-y-2">
        <TagPicker
          availableTags={availableTags}
          selectedTags={tags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          resolveTagStyle={resolveTagStyle}
          inputPlaceholder="Add tag (press Enter or comma)"
          allowCreate
          popoverDropdown
          selectedTagBadgeClassName={cn(
            "text-xs",
            isPassage && "border-amber-300 dark:border-amber-600/50"
          )}
        />
      </div>

      <div className="flex justify-end gap-2">
        {!isDialogPresentation && (
          <TooltipButton variant="ghost" size="sm" onClick={onCancel} tooltip="Cancel (Esc)">
            Cancel
          </TooltipButton>
        )}
        <TooltipButton
          size="sm"
          onClick={() => content.trim() && onSave(content.trim(), tags)}
          disabled={!content.trim()}
          tooltip={content.trim() ? "Save note (⌘Enter)" : "Enter content to save"}
        >
          Save
        </TooltipButton>
      </div>

      <p className="text-xs text-muted-foreground">
        {/(Mac|iPhone|iPad)/i.test(navigator.userAgent) ? "Cmd" : "Ctrl"}+Enter to save
        &middot; Esc to cancel
      </p>
    </div>
  )
}
