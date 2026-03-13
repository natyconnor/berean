import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Check, FlaskConical, Loader2, Trash2 } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { normalizeTag } from "@/lib/tag-utils";
import { ImportExportSection } from "@/components/settings/import-export-section";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import {
  ALL_STARTER_TAGS,
  DEFAULT_STARTER_TAG_CATEGORY_COLORS,
  STARTER_TAG_CATEGORIES,
} from "@/lib/starter-tags";
import type { TutorialStatus } from "../../../convex/lib/tutorial";

export const Route = createFileRoute("/settings/tags")({
  component: LegacyTagSettingsRedirect,
});

function LegacyTagSettingsRedirect() {
  return <Navigate to="/settings" replace />;
}

export function SettingsPage() {
  const catalog = useQuery(api.tags.listCatalog);
  const setupStatus: TutorialStatus | undefined = useQuery(
    api.userSettings.getTutorialStatus,
  );
  const addMany = useMutation(api.tags.addMany);
  const removeMany = useMutation(api.tags.removeMany);
  const removeCustomTagAndDetach = useMutation(
    api.tags.removeCustomTagAndDetach,
  );
  const completeSetup = useMutation(api.userSettings.completeStarterTagsSetup);
  const setCategoryColor = useMutation(
    api.userSettings.setStarterTagCategoryColor,
  );
  const seedDevChapterNotes = useMutation(api.seed.seedDevChapterNotes);
  const { startTour } = useTutorial();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [draftCategoryColors, setDraftCategoryColors] = useState<
    Record<string, string>
  >({});
  const [customTagInput, setCustomTagInput] = useState("");
  const [deleteTagCandidate, setDeleteTagCandidate] = useState<string | null>(
    null,
  );
  const [seedResult, setSeedResult] = useState<{
    seed: number;
    selectedChapters: number;
    heavyChapters: number;
    notesCreated: number;
    verseRefsCreated: number;
    linksCreated: number;
    testamentDistribution: { ot: number; nt: number };
    cleanup: {
      notesDeleted: number;
      linksDeleted: number;
      verseRefsDeleted: number;
    };
    usedTags: string[];
  } | null>(null);

  const catalogByTag = useMemo(() => {
    const entries = catalog ?? [];
    return new Map(entries.map((entry) => [entry.tag, entry]));
  }, [catalog]);

  const customTags = useMemo(
    () => (catalog ?? []).filter((entry) => entry.source === "custom"),
    [catalog],
  );

  const parsedCustomTagInput = useMemo(() => {
    const inputTags = customTagInput
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => normalizeTag(part))
      .filter((part) => part.length > 0);

    const seen = new Set<string>();
    const duplicateTagsInInput: string[] = [];
    const duplicateTagsInCatalog: string[] = [];
    const tagsToAdd: string[] = [];

    for (const tag of inputTags) {
      if (seen.has(tag)) {
        duplicateTagsInInput.push(tag);
        continue;
      }
      seen.add(tag);

      if (catalogByTag.has(tag)) {
        duplicateTagsInCatalog.push(tag);
        continue;
      }

      tagsToAdd.push(tag);
    }

    return {
      duplicateTagsInInput,
      duplicateTagsInCatalog,
      tagsToAdd,
    };
  }, [catalogByTag, customTagInput]);

  const categoryColors = useMemo<Record<string, string>>(
    () => ({
      ...DEFAULT_STARTER_TAG_CATEGORY_COLORS,
      ...(setupStatus?.categoryColors ?? {}),
    }),
    [setupStatus?.categoryColors],
  );

  useEffect(() => {
    setDraftCategoryColors(categoryColors);
  }, [categoryColors]);

  useEffect(() => {
    if (setupStatus?.needsStarterTagsSetup) {
      void completeSetup({});
    }
  }, [setupStatus?.needsStarterTagsSetup, completeSetup]);

  const selectedStarterCount = useMemo(() => {
    let count = 0;
    for (const tag of ALL_STARTER_TAGS) {
      if (catalogByTag.has(tag)) count += 1;
    }
    return count;
  }, [catalogByTag]);

  const isLoading = catalog === undefined || setupStatus === undefined;
  const isDev = import.meta.env.DEV;

  const handleAddAll = async () => {
    setBusyAction("add-all");
    try {
      await addMany({ tags: ALL_STARTER_TAGS, source: "starter" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddCategory = async (categoryId: string, tags: string[]) => {
    setBusyAction(`add-category:${categoryId}`);
    try {
      await addMany({ tags, source: "starter" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleTag = async (tag: string) => {
    const existing = catalogByTag.get(tag);
    const isStarterTagInCatalog = existing?.source === "starter";
    const isCustomTagInCatalog = existing?.source === "custom";

    if (isCustomTagInCatalog) return;

    setBusyAction(`toggle:${tag}`);
    try {
      if (isStarterTagInCatalog) {
        await removeMany({ tags: [tag] });
      } else {
        await addMany({ tags: [tag], source: "starter" });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const colorSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const saveCategoryColor = useCallback(
    (categoryId: string, color: string) => {
      void setCategoryColor({ categoryId, color });
    },
    [setCategoryColor],
  );

  const handleColorChange = useCallback(
    (categoryId: string, color: string) => {
      setDraftCategoryColors((prev) => ({ ...prev, [categoryId]: color }));

      if (colorSaveTimers.current[categoryId]) {
        clearTimeout(colorSaveTimers.current[categoryId]);
      }
      colorSaveTimers.current[categoryId] = setTimeout(() => {
        saveCategoryColor(categoryId, color);
        delete colorSaveTimers.current[categoryId];
      }, 500);
    },
    [saveCategoryColor],
  );

  useEffect(() => {
    const timers = colorSaveTimers.current;
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const handleAddCustomTags = async () => {
    const tags = parsedCustomTagInput.tagsToAdd;

    if (tags.length === 0) return;

    setBusyAction("add-custom");
    try {
      await addMany({ tags, source: "custom" });
      setCustomTagInput("");
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmDeleteCustomTag = async () => {
    if (!deleteTagCandidate) return;

    setBusyAction(`delete-custom:${deleteTagCandidate}`);
    try {
      await removeCustomTagAndDetach({ tag: deleteTagCandidate });
      setDeleteTagCandidate(null);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunDevSeed = async () => {
    setBusyAction("seed-dev-notes");
    try {
      const result = await seedDevChapterNotes({
        confirmReplace: true,
      });
      setSeedResult({
        seed: result.seed,
        selectedChapters: result.selectedChapters,
        heavyChapters: result.heavyChapters,
        notesCreated: result.notesCreated,
        verseRefsCreated: result.verseRefsCreated,
        linksCreated: result.linksCreated,
        testamentDistribution: result.testamentDistribution,
        cleanup: result.cleanup,
        usedTags: result.usedTags,
      });
    } finally {
      setBusyAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage import/export, tags, and category colors.
          </p>
        </div>

        <ImportExportSection />

        <section className="rounded-lg border bg-card p-5 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Tags</h2>
            <p className="text-sm text-muted-foreground">
              Manage your custom tags and starter tag catalog. All changes save
              automatically.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Custom tags</h3>
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
                    event.preventDefault();
                    void handleAddCustomTags();
                  }
                }}
                placeholder="Add custom tag (comma-separated supported)"
                className="h-8 min-w-[280px] max-w-[460px]"
                disabled={busyAction !== null}
              />
              <Button
                size="sm"
                onClick={() => void handleAddCustomTags()}
                disabled={
                  busyAction !== null ||
                  parsedCustomTagInput.tagsToAdd.length === 0
                }
              >
                {busyAction === "add-custom" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Add custom tag
              </Button>
            </div>
            {customTagInput.trim().length > 0 && (
              <div className="space-y-1">
                {parsedCustomTagInput.duplicateTagsInInput.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Duplicate in input:{" "}
                    {parsedCustomTagInput.duplicateTagsInInput.join(", ")}
                  </p>
                )}
                {parsedCustomTagInput.duplicateTagsInCatalog.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Already exists:{" "}
                    {parsedCustomTagInput.duplicateTagsInCatalog.join(", ")}
                  </p>
                )}
                {parsedCustomTagInput.tagsToAdd.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ready to add: {parsedCustomTagInput.tagsToAdd.join(", ")}
                  </p>
                )}
                {parsedCustomTagInput.tagsToAdd.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No new tags to add.
                  </p>
                )}
              </div>
            )}
            {customTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom tags yet. They appear here as you create tags in
                notes.
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
          </div>

          <hr className="border-border" />

          <div className="space-y-4">
            <div
              className="flex flex-wrap items-center justify-between gap-3"
              data-tour-id="settings-starter-tags-section"
            >
              <div>
                <h3 className="text-sm font-semibold">Starter tags</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedStarterCount} / {ALL_STARTER_TAGS.length} selected
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleAddAll}
                disabled={busyAction !== null}
                data-tour-id="settings-add-all-starter-tags"
              >
                {busyAction === "add-all" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Add all starter tags
              </Button>
            </div>

            <div
              className="space-y-4"
              data-tour-id="settings-starter-tag-categories"
            >
              {STARTER_TAG_CATEGORIES.map((category) => {
                const categorySelectedCount = category.tags.filter((tag) =>
                  catalogByTag.has(tag),
                ).length;
                const addCategoryActionId = `add-category:${category.id}`;
                const draftCategoryColor =
                  draftCategoryColors[category.id] ??
                  categoryColors[category.id] ??
                  DEFAULT_STARTER_TAG_CATEGORY_COLORS[category.id];

                return (
                  <div
                    key={category.id}
                    className="rounded-lg border p-4 space-y-3 border-l-4"
                    style={{ borderLeftColor: draftCategoryColor }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold">
                          {category.label}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {categorySelectedCount} / {category.tags.length}{" "}
                          selected
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busyAction !== null}
                        onClick={() =>
                          void handleAddCategory(category.id, category.tags)
                        }
                      >
                        {busyAction === addCategoryActionId && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Add category
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
                      <div
                        className="h-4 w-4 rounded-sm border"
                        style={{ backgroundColor: draftCategoryColor }}
                      />
                      <label
                        htmlFor={`category-color-${category.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Category color
                      </label>
                      <input
                        id={`category-color-${category.id}`}
                        type="color"
                        value={draftCategoryColor}
                        disabled={busyAction !== null}
                        onChange={(e) =>
                          handleColorChange(category.id, e.target.value)
                        }
                        className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                      />
                      <code className="text-xs text-muted-foreground">
                        {draftCategoryColor}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {category.tags.map((tag) => {
                        const entry = catalogByTag.get(tag);
                        const isSelected = entry !== undefined;
                        const isStarter = entry?.source === "starter";
                        const isCustom = entry?.source === "custom";
                        const toggleActionId = `toggle:${tag}`;

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
                              busyAction === toggleActionId && "opacity-80",
                            )}
                            title={
                              isCustom
                                ? "Already in your catalog from custom usage"
                                : undefined
                            }
                          >
                            {busyAction === toggleActionId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              isSelected && <Check className="h-3 w-3" />
                            )}
                            {tag}
                            {isCustom && (
                              <span className="text-[10px] text-muted-foreground">
                                custom
                              </span>
                            )}
                            {isStarter && (
                              <span className="text-[10px] text-muted-foreground">
                                starter
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {isDev && (
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                  Dev note seed
                </h2>
                <p className="text-xs text-muted-foreground">
                  Replace your current notes with generated chapter-linked test
                  data (50 chapters, 10 heavy).
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRunDevSeed()}
                disabled={busyAction !== null}
              >
                {busyAction === "seed-dev-notes" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Generate dev test notes
              </Button>
            </div>

            {seedResult && (
              <div className="rounded-md border bg-background p-3 space-y-2 text-xs">
                <p className="text-muted-foreground">
                  Seed <code>{seedResult.seed}</code> complete.
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  <p>
                    Notes created:{" "}
                    <span className="font-semibold">
                      {seedResult.notesCreated}
                    </span>
                  </p>
                  <p>
                    Verse refs created:{" "}
                    <span className="font-semibold">
                      {seedResult.verseRefsCreated}
                    </span>
                  </p>
                  <p>
                    Links created:{" "}
                    <span className="font-semibold">
                      {seedResult.linksCreated}
                    </span>
                  </p>
                  <p>
                    Chapters:{" "}
                    <span className="font-semibold">
                      {seedResult.selectedChapters} (
                      {seedResult.testamentDistribution.ot} OT /{" "}
                      {seedResult.testamentDistribution.nt} NT)
                    </span>
                  </p>
                  <p>
                    Heavy chapters:{" "}
                    <span className="font-semibold">
                      {seedResult.heavyChapters}
                    </span>
                  </p>
                  <p>
                    Cleanup removed:{" "}
                    <span className="font-semibold">
                      {seedResult.cleanup.notesDeleted} notes,{" "}
                      {seedResult.cleanup.linksDeleted} links,{" "}
                      {seedResult.cleanup.verseRefsDeleted} verse refs
                    </span>
                  </p>
                </div>
                <p className="text-muted-foreground">
                  Starter tags used:{" "}
                  <span className="font-medium">
                    {seedResult.usedTags.length}
                  </span>
                </p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Tutorials</h2>
            <p className="text-xs text-muted-foreground">
              Replay the guided tours any time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => startTour("main")}
              disabled={busyAction !== null}
            >
              Replay main tour
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => startTour("search")}
              disabled={busyAction !== null}
            >
              Replay advanced search tour
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={deleteTagCandidate !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTagCandidate(null);
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
              {deleteTagCandidate &&
                busyAction === `delete-custom:${deleteTagCandidate}` && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              Delete tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
