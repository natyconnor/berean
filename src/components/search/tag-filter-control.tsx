import { type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { TagPicker } from "@/components/tags/tag-picker"

interface TagFilterControlProps {
  availableTags: string[]
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  onClear: () => void
  resolveTagStyle?: (tag: string) => CSSProperties | undefined
  /** When true, the autocomplete dropdown floats over content instead of pushing it down */
  popoverDropdown?: boolean
}

export function TagFilterControl({
  availableTags,
  selectedTags,
  onToggleTag,
  onClear,
  resolveTagStyle,
  popoverDropdown = false,
}: TagFilterControlProps) {
  const hasSelectedTags = selectedTags.length > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tags
        </p>
        <Button
          size="xs"
          variant="ghost"
          onClick={onClear}
          disabled={!hasSelectedTags}
        >
          Clear
        </Button>
      </div>

      {availableTags.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No tags yet. Add tags to notes to enable filtering.
        </p>
      )}

      <TagPicker
        availableTags={availableTags}
        selectedTags={selectedTags}
        onAddTag={(tag) => {
          if (!selectedTags.includes(tag)) {
            onToggleTag(tag)
          }
        }}
        onRemoveTag={onToggleTag}
        resolveTagStyle={resolveTagStyle}
        inputPlaceholder="Filter tags..."
        popoverDropdown={popoverDropdown}
        clearInputOnEscape
      />
    </div>
  )
}
