import { useState, useCallback, useEffect, useRef } from "react"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { formatVerseRef } from "@/lib/verse-ref-utils"

interface NoteEditorProps {
  verseRef: VerseRef
  initialContent?: string
  initialTags?: string[]
  variant?: "default" | "passage"
  onSave: (content: string, tags: string[]) => void
  onCancel: () => void
}

export function NoteEditor({
  verseRef,
  initialContent = "",
  initialTags = [],
  variant = "default",
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagInput, setTagInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag])
    }
    setTagInput("")
  }, [tagInput, tags])

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

  return (
    <div
      className={cn(
        "rounded-lg p-3 shadow-sm space-y-3",
        isPassage
          ? "border-l-2 border border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/50 border-l-amber-400 dark:border-l-amber-600/70"
          : "border bg-card"
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
        <TooltipButton variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel} tooltip="Cancel">
          <X className="h-3.5 w-3.5" />
        </TooltipButton>
      </div>

      <Textarea
        ref={textareaRef}
        placeholder="Write your note..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[100px] resize-y text-sm"
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "text-xs gap-1",
                isPassage && "border-amber-300 dark:border-amber-600/50"
              )}
            >
              {tag}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Remove tag</TooltipContent>
              </Tooltip>
            </Badge>
          ))}
        </div>
        <Input
          placeholder="Add tag (press Enter)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              addTag()
            }
          }}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2">
        <TooltipButton variant="ghost" size="sm" onClick={onCancel} tooltip="Cancel (Esc)">
          Cancel
        </TooltipButton>
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
