import { useState, useCallback, useMemo } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { Badge } from "@/components/ui/badge"
import { X, BookOpen } from "lucide-react"
import { TagPicker } from "@/components/tags/tag-picker"
import { cn } from "@/lib/utils"
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles"
import { normalizeTags } from "@/lib/tag-utils"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { formatVerseRef } from "@/lib/verse-ref-utils"
import {
  normalizeNoteBody,
  noteBodyToPlainText,
  type NoteBody,
} from "@/lib/note-inline-content"
import { InlineVerseEditor } from "@/components/notes/editor/inline-verse-editor"
import { api } from "../../../convex/_generated/api"

interface NoteEditorProps {
  verseRef: VerseRef
  initialContent?: string
  initialBody?: NoteBody
  initialTags?: string[]
  variant?: "default" | "passage"
  presentation?: "card" | "dialog"
  onSave: (body: NoteBody, tags: string[]) => void | Promise<void>
  onCancel: () => void
}

export function NoteEditor({
  verseRef,
  initialContent = "",
  initialBody,
  initialTags = [],
  variant = "default",
  presentation = "card",
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [initialEditorBody] = useState<NoteBody>(() => normalizeNoteBody(initialBody, initialContent))
  const [body, setBody] = useState<NoteBody>(initialEditorBody)
  const [tags, setTags] = useState<string[]>(() => normalizeTags(initialTags))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const catalog = useQuery(api.tags.listCatalog)
  const resolveTagStyle = useStarterTagBadgeStyle()

  const availableTags = useMemo(() => (catalog ?? []).map((entry) => entry.tag), [catalog])

  const addTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }, [])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleEditorChange = useCallback((nextBody: NoteBody) => {
    setBody(nextBody)
    setSaveError(null)
  }, [])

  const handleSave = useCallback(async () => {
    const content = noteBodyToPlainText(body).trim()
    if (!content || isSaving) {
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave(body, tags)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save note")
    } finally {
      setIsSaving(false)
    }
  }, [body, isSaving, onSave, tags])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const content = noteBodyToPlainText(body).trim()
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (content) {
          void handleSave()
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    },
    [body, handleSave, onCancel]
  )

  const isPassage = variant === "passage"
  const isDialogPresentation = presentation === "dialog"
  const plainText = noteBodyToPlainText(body).trim()

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

      <InlineVerseEditor
        initialBody={initialEditorBody}
        verseRef={verseRef}
        onChange={handleEditorChange}
        className={cn(isDialogPresentation ? "min-h-[180px]" : "min-h-[96px]")}
      />

      {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}

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
          onClick={() => {
            void handleSave()
          }}
          disabled={!plainText || isSaving}
          tooltip={
            !plainText
              ? "Enter content to save"
              : isSaving
                ? "Saving note..."
                : "Save note (⌘Enter)"
          }
        >
          {isSaving ? "Saving..." : "Save"}
        </TooltipButton>
      </div>

      <p className="text-xs text-muted-foreground">
        {/(Mac|iPhone|iPad)/i.test(navigator.userAgent) ? "Cmd" : "Ctrl"}+Enter to save
        &middot; Esc to cancel
      </p>
    </div>
  )
}
