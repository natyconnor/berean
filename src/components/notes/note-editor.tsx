import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles"
import { normalizeTag, normalizeTags } from "@/lib/tag-utils"
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
  const [tagInput, setTagInput] = useState("")
  const [tagInputFocused, setTagInputFocused] = useState(false)
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const suggestionResults = useQuery(
    api.tags.suggest,
    tagInput.trim().length > 0 ? { query: tagInput, limit: 8 } : "skip"
  )
  const resolveTagStyle = useStarterTagBadgeStyle()

  const suggestions = useMemo(
    () => (suggestionResults ?? []).filter((result) => !tags.includes(result.tag)),
    [suggestionResults, tags]
  )

  const activeSuggestionIndex =
    suggestions.length === 0
      ? -1
      : Math.min(highlightedSuggestion, suggestions.length - 1)

  const addTag = useCallback((rawTag: string) => {
    const tag = normalizeTag(rawTag)
    if (tag) {
      setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
    }
    setTagInput("")
    setHighlightedSuggestion(0)
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
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "text-xs gap-1",
                isPassage && "border-amber-300 dark:border-amber-600/50"
              )}
              style={resolveTagStyle(tag)}
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
          placeholder="Add tag (press Enter or comma)"
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value)
            setHighlightedSuggestion(0)
          }}
          onFocus={() => setTagInputFocused(true)}
          onBlur={() => setTagInputFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length > 0) {
              e.preventDefault()
              setHighlightedSuggestion((prev) => (prev + 1) % suggestions.length)
              return
            }
            if (e.key === "ArrowUp" && suggestions.length > 0) {
              e.preventDefault()
              setHighlightedSuggestion((prev) =>
                prev === 0 ? suggestions.length - 1 : prev - 1
              )
              return
            }
            if (e.key === "Enter") {
              e.preventDefault()
              const highlighted = suggestions[activeSuggestionIndex]
              if (highlighted) {
                addTag(highlighted.tag)
                return
              }
              addTag(tagInput)
              return
            }
            if (e.key === ",") {
              e.preventDefault()
              addTag(tagInput)
              return
            }
            if (e.key === "Backspace" && tagInput.length === 0 && tags.length > 0) {
              e.preventDefault()
              removeTag(tags[tags.length - 1])
              return
            }
          }}
          className="h-8 text-sm"
        />
        {tagInputFocused && suggestions.length > 0 && (
          <div className="rounded-md border bg-popover p-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.tag}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addTag(suggestion.tag)
                }}
                className={cn(
                  "w-full rounded-sm px-2 py-1 text-left text-xs transition-colors",
                  index === activeSuggestionIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60"
                )}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
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
