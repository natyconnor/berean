"use client"

import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { normalizeTag } from "@/lib/tag-utils"
import { cn } from "@/lib/utils"

const DEFAULT_MAX_SUGGESTIONS = 20

interface TagPickerProps {
  availableTags: string[]
  selectedTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  resolveTagStyle?: (tag: string) => CSSProperties | undefined
  inputPlaceholder?: string
  allowCreate?: boolean
  popoverDropdown?: boolean
  clearInputOnEscape?: boolean
  showSuggestionsOnFocus?: boolean
  maxSuggestions?: number
  selectedTagBadgeClassName?: string
}

export function TagPicker({
  availableTags,
  selectedTags,
  onAddTag,
  onRemoveTag,
  resolveTagStyle,
  inputPlaceholder = "Add tag...",
  allowCreate = false,
  popoverDropdown = false,
  clearInputOnEscape = false,
  showSuggestionsOnFocus = true,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  selectedTagBadgeClassName,
}: TagPickerProps) {
  const [input, setInput] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0)

  const suggestions = useMemo(() => {
    const normalizedInput = input.trim().toLowerCase()
    const shouldShowAll = normalizedInput.length === 0 && showSuggestionsOnFocus

    if (normalizedInput.length === 0 && !shouldShowAll) {
      return []
    }

    return availableTags
      .filter((tag) => !selectedTags.includes(tag))
      .filter((tag) => (normalizedInput.length === 0 ? true : tag.toLowerCase().includes(normalizedInput)))
      .slice(0, maxSuggestions)
  }, [availableTags, input, maxSuggestions, selectedTags, showSuggestionsOnFocus])

  const activeSuggestionIndex =
    suggestions.length === 0 ? -1 : Math.min(highlightedSuggestion, suggestions.length - 1)

  const resetInput = useCallback(() => {
    setInput("")
    setHighlightedSuggestion(0)
  }, [])

  const handleSelectSuggestion = useCallback(
    (tag: string) => {
      if (!selectedTags.includes(tag)) {
        onAddTag(tag)
      }
      resetInput()
    },
    [onAddTag, resetInput, selectedTags]
  )

  const handleCreateTag = useCallback(
    (rawTag: string) => {
      const tag = normalizeTag(rawTag)
      if (tag && !selectedTags.includes(tag)) {
        onAddTag(tag)
      }
      resetInput()
    },
    [onAddTag, resetInput, selectedTags]
  )

  return (
    <div className="space-y-2">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={`selected-${tag}`}
              variant="outline"
              className={cn("gap-1", selectedTagBadgeClassName)}
              style={resolveTagStyle?.(tag)}
            >
              {tag}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Remove tag</TooltipContent>
              </Tooltip>
            </Badge>
          ))}
        </div>
      )}

      <div className={popoverDropdown ? "relative" : "space-y-2"}>
        <Input
          placeholder={inputPlaceholder}
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setHighlightedSuggestion(0)
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 120)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length > 0) {
              event.preventDefault()
              setHighlightedSuggestion((prev) => (prev + 1) % suggestions.length)
              return
            }

            if (event.key === "ArrowUp" && suggestions.length > 0) {
              event.preventDefault()
              setHighlightedSuggestion((prev) => (prev === 0 ? suggestions.length - 1 : prev - 1))
              return
            }

            if (event.key === "Enter") {
              const highlighted = suggestions[activeSuggestionIndex]
              if (highlighted) {
                event.preventDefault()
                handleSelectSuggestion(highlighted)
                return
              }

              if (allowCreate) {
                event.preventDefault()
                handleCreateTag(input)
              }
              return
            }

            if (event.key === "," && allowCreate) {
              event.preventDefault()
              handleCreateTag(input)
              return
            }

            if (event.key === "Backspace" && input.length === 0 && selectedTags.length > 0) {
              event.preventDefault()
              onRemoveTag(selectedTags[selectedTags.length - 1])
              return
            }

            if (event.key === "Escape" && clearInputOnEscape) {
              setInput("")
              setHighlightedSuggestion(0)
            }
          }}
          className="h-8 text-sm"
        />

        {isFocused && suggestions.length > 0 && (
          <div
            className={
              popoverDropdown
                ? "absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
                : "rounded-md border bg-popover p-1"
            }
          >
            {suggestions.map((tag, index) => (
              <button
                key={`suggestion-${tag}`}
                type="button"
                className={cn(
                  "w-full rounded-sm px-2 py-1 text-left text-xs transition-colors",
                  index === activeSuggestionIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60"
                )}
                onMouseDown={(event) => {
                  event.preventDefault()
                  handleSelectSuggestion(tag)
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
