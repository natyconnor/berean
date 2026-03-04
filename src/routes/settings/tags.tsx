import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { Check, Loader2, Trash2 } from "lucide-react"

import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { normalizeTag } from "@/lib/tag-utils"
import {
  ALL_STARTER_TAGS,
  DEFAULT_STARTER_TAG_CATEGORY_COLORS,
  STARTER_TAGS_VERSION,
  STARTER_TAG_CATEGORIES,
} from "@/lib/starter-tags"

export const Route = createFileRoute("/settings/tags")({
  component: StarterTagsSettingsPage,
})

function StarterTagsSettingsPage() {
  const navigate = useNavigate()
  const catalog = useQuery(api.tags.listCatalog)
  const setupStatus = useQuery(api.userSettings.getStarterTagsSetupStatus)
  const addMany = useMutation(api.tags.addMany)
  const removeMany = useMutation(api.tags.removeMany)
  const removeCustomTagAndDetach = useMutation(api.tags.removeCustomTagAndDetach)
  const completeSetup = useMutation(api.userSettings.completeStarterTagsSetup)
  const setCategoryColor = useMutation(api.userSettings.setStarterTagCategoryColor)

  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [draftCategoryColors, setDraftCategoryColors] = useState<Record<string, string>>({})
  const [customTagInput, setCustomTagInput] = useState("")
  const [deleteTagCandidate, setDeleteTagCandidate] = useState<string | null>(null)

  const catalogByTag = useMemo(() => {
    const entries = catalog ?? []
    return new Map(entries.map((entry) => [entry.tag, entry]))
  }, [catalog])

  const customTags = useMemo(
    () => (catalog ?? []).filter((entry) => entry.source === "custom"),
    [catalog]
  )

  const parsedCustomTagInput = useMemo(() => {
    const inputTags = customTagInput
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => normalizeTag(part))
      .filter((part) => part.length > 0)

    const seen = new Set<string>()
    const duplicateTagsInInput: string[] = []
    const duplicateTagsInCatalog: string[] = []
    const tagsToAdd: string[] = []

    for (const tag of inputTags) {
      if (seen.has(tag)) {
        duplicateTagsInInput.push(tag)
        continue
      }
      seen.add(tag)

      if (catalogByTag.has(tag)) {
        duplicateTagsInCatalog.push(tag)
        continue
      }

      tagsToAdd.push(tag)
    }

    return {
      duplicateTagsInInput,
      duplicateTagsInCatalog,
      tagsToAdd,
    }
  }, [catalogByTag, customTagInput])

  const categoryColors = useMemo<Record<string, string>>(
    () => ({
      ...DEFAULT_STARTER_TAG_CATEGORY_COLORS,
      ...(setupStatus?.categoryColors ?? {}),
    }),
    [setupStatus?.categoryColors]
  )

  useEffect(() => {
    setDraftCategoryColors(categoryColors)
  }, [categoryColors])

  const selectedStarterCount = useMemo(() => {
    let count = 0
    for (const tag of ALL_STARTER_TAGS) {
      if (catalogByTag.has(tag)) count += 1
    }
    return count
  }, [catalogByTag])

  const isLoading = catalog === undefined || setupStatus === undefined

  const handleAddAll = async () => {
    setBusyAction("add-all")
    try {
      await addMany({ tags: ALL_STARTER_TAGS, source: "starter" })
    } finally {
      setBusyAction(null)
    }
  }

  const handleAddCategory = async (categoryId: string, tags: string[]) => {
    setBusyAction(`add-category:${categoryId}`)
    try {
      await addMany({ tags, source: "starter" })
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleTag = async (tag: string) => {
    const existing = catalogByTag.get(tag)
    const isStarterTagInCatalog = existing?.source === "starter"
    const isCustomTagInCatalog = existing?.source === "custom"

    if (isCustomTagInCatalog) return

    setBusyAction(`toggle:${tag}`)
    try {
      if (isStarterTagInCatalog) {
        await removeMany({ tags: [tag] })
      } else {
        await addMany({ tags: [tag], source: "starter" })
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handleComplete = async () => {
    setBusyAction("complete")
    try {
      await completeSetup({})
      navigate({ to: "/" })
    } finally {
      setBusyAction(null)
    }
  }

  const handleSaveCategoryColor = async (categoryId: string) => {
    const color = draftCategoryColors[categoryId] ?? DEFAULT_STARTER_TAG_CATEGORY_COLORS[categoryId]
    setBusyAction(`save-color:${categoryId}`)
    try {
      await setCategoryColor({ categoryId, color })
    } finally {
      setBusyAction(null)
    }
  }

  const handleAddCustomTags = async () => {
    const tags = parsedCustomTagInput.tagsToAdd

    if (tags.length === 0) return

    setBusyAction("add-custom")
    try {
      await addMany({ tags, source: "custom" })
      setCustomTagInput("")
    } finally {
      setBusyAction(null)
    }
  }

  const handleConfirmDeleteCustomTag = async () => {
    if (!deleteTagCandidate) return

    setBusyAction(`delete-custom:${deleteTagCandidate}`)
    try {
      await removeCustomTagAndDetach({ tag: deleteTagCandidate })
      setDeleteTagCandidate(null)
    } finally {
      setBusyAction(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const firstTimeSetup = setupStatus.needsStarterTagsSetup

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Tag settings</h1>
            <Badge variant="outline" className="text-xs">
              Taxonomy v{STARTER_TAGS_VERSION}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your full tag catalog: custom tags, starter sets, and starter category colors.
          </p>
          {firstTimeSetup && (
            <p className="text-sm text-foreground">
              Complete this quick setup before continuing. You can always update starter tags later.
            </p>
          )}
        </div>

        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Your custom tags</h2>
            <Badge variant="outline" className="text-xs">
              {customTags.length}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={customTagInput}
              onChange={(event) => setCustomTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleAddCustomTags()
                }
              }}
              placeholder="Add custom tag (comma-separated supported)"
              className="h-8 min-w-[280px] max-w-[460px]"
              disabled={busyAction !== null}
            />
            <Button
              size="sm"
              onClick={() => void handleAddCustomTags()}
              disabled={busyAction !== null || parsedCustomTagInput.tagsToAdd.length === 0}
            >
              {busyAction === "add-custom" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add custom tag
            </Button>
          </div>
          {customTagInput.trim().length > 0 && (
            <div className="space-y-1">
              {parsedCustomTagInput.duplicateTagsInInput.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Duplicate in input: {parsedCustomTagInput.duplicateTagsInInput.join(", ")}
                </p>
              )}
              {parsedCustomTagInput.duplicateTagsInCatalog.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Already exists: {parsedCustomTagInput.duplicateTagsInCatalog.join(", ")}
                </p>
              )}
              {parsedCustomTagInput.tagsToAdd.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ready to add: {parsedCustomTagInput.tagsToAdd.join(", ")}
                </p>
              )}
              {parsedCustomTagInput.tagsToAdd.length === 0 && (
                <p className="text-xs text-muted-foreground">No new tags to add.</p>
              )}
            </div>
          )}
          {customTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No custom tags yet. They appear here as you create tags in notes.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customTags.map((entry) => (
                <span
                  key={entry.tag}
                  className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
                >
                  {entry.label}
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTagCandidate(entry.tag)}
                    aria-label={`Delete custom tag ${entry.label}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Selected starter tags:{" "}
              <span className="font-semibold">{selectedStarterCount}</span> / {ALL_STARTER_TAGS.length}
            </p>
            <Button
              size="sm"
              onClick={handleAddAll}
              disabled={busyAction !== null}
            >
              {busyAction === "add-all" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add all starter tags
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {STARTER_TAG_CATEGORIES.map((category) => {
            const categorySelectedCount = category.tags.filter((tag) => catalogByTag.has(tag)).length
            const addCategoryActionId = `add-category:${category.id}`
            const saveCategoryColorActionId = `save-color:${category.id}`
            const persistedCategoryColor =
              categoryColors[category.id] ?? DEFAULT_STARTER_TAG_CATEGORY_COLORS[category.id]
            const draftCategoryColor =
              draftCategoryColors[category.id] ?? persistedCategoryColor
            const isColorDirty =
              draftCategoryColor.toLowerCase() !== persistedCategoryColor.toLowerCase()

            return (
              <section
                key={category.id}
                className="rounded-lg border bg-card p-4 space-y-3 border-l-4"
                style={{ borderLeftColor: draftCategoryColor }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{category.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {categorySelectedCount} / {category.tags.length} selected
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busyAction !== null}
                    onClick={() => void handleAddCategory(category.id, category.tags)}
                  >
                    {busyAction === addCategoryActionId && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Add category
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
                  <div className="h-4 w-4 rounded-sm border" style={{ backgroundColor: draftCategoryColor }} />
                  <label htmlFor={`category-color-${category.id}`} className="text-xs text-muted-foreground">
                    Category color
                  </label>
                  <input
                    id={`category-color-${category.id}`}
                    type="color"
                    value={draftCategoryColor}
                    disabled={busyAction !== null}
                    onChange={(e) => {
                      const color = e.target.value
                      setDraftCategoryColors((prev) => ({
                        ...prev,
                        [category.id]: color,
                      }))
                    }}
                    className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                  />
                  <code className="text-xs text-muted-foreground">{draftCategoryColor}</code>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busyAction !== null || !isColorDirty}
                    onClick={() => {
                      setDraftCategoryColors((prev) => ({
                        ...prev,
                        [category.id]: category.defaultColor,
                      }))
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="xs"
                    disabled={busyAction !== null || !isColorDirty}
                    onClick={() => void handleSaveCategoryColor(category.id)}
                  >
                    {busyAction === saveCategoryColorActionId && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Save color
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {category.tags.map((tag) => {
                    const entry = catalogByTag.get(tag)
                    const isSelected = entry !== undefined
                    const isStarter = entry?.source === "starter"
                    const isCustom = entry?.source === "custom"
                    const toggleActionId = `toggle:${tag}`

                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={busyAction !== null || isCustom}
                        onClick={() => void handleToggleTag(tag)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                          isSelected
                            ? "border-primary/30 bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                          isCustom && "cursor-not-allowed opacity-70",
                          busyAction === toggleActionId && "opacity-80"
                        )}
                        title={isCustom ? "Already in your catalog from custom usage" : undefined}
                      >
                        {busyAction === toggleActionId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          isSelected && <Check className="h-3 w-3" />
                        )}
                        {tag}
                        {isCustom && (
                          <span className="text-[10px] text-muted-foreground">custom</span>
                        )}
                        {isStarter && (
                          <span className="text-[10px] text-muted-foreground">starter</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleComplete}
            disabled={busyAction !== null}
          >
            Continue without changes
          </Button>
          <Button onClick={handleComplete} disabled={busyAction !== null}>
            {busyAction === "complete" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save and continue
          </Button>
        </div>
      </div>

      <Dialog
        open={deleteTagCandidate !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTagCandidate(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete custom tag?</DialogTitle>
            <DialogDescription>
              {deleteTagCandidate
                ? `This will remove "${deleteTagCandidate}" from your custom tags and from any notes that use it. This action cannot be undone.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTagCandidate(null)}
              disabled={busyAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDeleteCustomTag()}
              disabled={deleteTagCandidate === null || busyAction !== null}
            >
              {deleteTagCandidate && busyAction === `delete-custom:${deleteTagCandidate}` && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Delete tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
